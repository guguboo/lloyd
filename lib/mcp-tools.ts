// lib/mcp-tools.ts — single implementation of every Lloyd MCP tool.
// Composed by both endpoints: /api/quote (free surface) and /api/mcp (full, keyed).
import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { isAddress } from 'viem';
import { COVERAGE_RATIO, TIERS, coverageForTier, evaluateQuote } from '@/lib/underwrite/engine';
import { canBind } from '@/lib/treasury/solvency';
import { getReputationSource } from '@/lib/okx';
import { assessFraud } from '@/lib/fraud';
import { verifyUsdtTransfer } from '@/lib/payment-proof';
import { attestationMessage, verifyDeliveryAttestation } from '@/lib/attestation';
import { activeNetwork, proofRequired } from '@/lib/xlayer';
import { TREASURY } from '@/lib/chain';
import { walletMismatch } from './auth-context';
import {
  attestDelivery, bindQuote, createQuote, getBindContext, getFraudContext, getOpenQuote,
  getPolicy, getProviderWallet, isLinked, markPolicy, openClaim,
} from '@/lib/store';

export type Srv = Parameters<Parameters<typeof createMcpHandler>[0]>[0];

const json = (v: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(v) }] });

// Error sanitization (H-7): an unexpected throw (e.g. a raw DB error) must never reach a
// public client. Log the detail server-side, return a stable code. Expected business
// outcomes are returned explicitly by each tool and never hit this.
type ToolResult = ReturnType<typeof json>;
const guard =
  <A>(fn: (a: A) => Promise<ToolResult>) =>
  async (a: A): Promise<ToolResult> => {
    try {
      return await fn(a);
    } catch (e) {
      console.error('[mcp] tool_error', e);
      return json({ ok: false, error: 'internal_error' });
    }
  };

/** Free surface: safe on an open, unauthenticated endpoint. get_quote/get_policy are
 *  reads; attest_delivery is self-authenticating (the EIP-191 signature IS the credential). */
export function registerFreeTools(server: Srv): void {
  server.tool(
    'get_quote',
    'Price delivery protection for hiring a provider agent. Returns three fixed-price tiers (skiff/frigate/galleon) with the coverage each buys, a recommended tier, and a 1-hour quote_id — or a decline with reason.',
    {
      provider_id: z.string().min(1).max(200).describe('OKX.AI agent id of the provider you intend to hire'),
      buyer_wallet: z.string().min(1).max(100).describe('Your wallet address — payout destination if a claim pays'),
      job_value_usdt: z.number().positive().finite().max(1_000_000).describe('Agreed job value in USDT'),
      job_type: z.string().max(200).default('general').describe('Free-text job category'),
    },
    guard(async ({ provider_id, buyer_wallet, job_value_usdt, job_type }) => {
      let record;
      try {
        record = await getReputationSource().getProviderRecord(provider_id, buyer_wallet);
      } catch {
        return json({ decision: 'decline', reason: 'data_unavailable' }); // decline, never guess
      }
      if (!record) return json({ decision: 'decline', reason: 'data_unavailable' });

      const decision = evaluateQuote(record, job_value_usdt);
      if (decision.decision === 'decline') return json(decision);
      // Payout destination must be a real address (H-6). Checked after the fraud/decline
      // gate so a linked-wallet fraud attempt still declines on its own reason first.
      if (!isAddress(buyer_wallet)) return json({ decision: 'decline', reason: 'invalid_buyer_wallet' });

      const quote = await createQuote({
        providerId: provider_id, buyerWallet: buyer_wallet, jobValueUsdt: job_value_usdt,
        jobType: job_type, riskClass: decision.riskClass,
        newcomer: decision.newcomer, recommendedTier: decision.recommendedTier,
      });
      return json({
        decision: 'quote', quote_id: quote.id, expires_at: quote.expiresAt,
        risk_class: decision.riskClass, newcomer: decision.newcomer,
        tiers: {
          skiff: { price: TIERS.skiff, coverage_usdt: decision.tiers.skiff },
          frigate: { price: TIERS.frigate, coverage_usdt: decision.tiers.frigate },
          galleon: { price: TIERS.galleon, coverage_usdt: decision.tiers.galleon },
        },
        recommended_tier: decision.recommendedTier,
        coverage_ratio: COVERAGE_RATIO,
        // The premium is collected onchain: pay the tier's price in USDT to pay_to, then
        // pass that tx hash to bind_policy as premium_tx.
        pay_to: TREASURY[activeNetwork()].address,
        settlement_asset: `USDT on X Layer ${activeNetwork()}`,
        proof_required: proofRequired(),
        terms: "Pays 80% of job value (up to the tier's coverage) if the provider does not attest delivery by deadline_at. Premium is the tier's fixed price, paid in USDT to pay_to.",
      });
    }),
  );

  server.tool(
    'get_policy',
    'Check the status of a Lloyd policy.',
    { policy_id: z.string().uuid() },
    guard(async ({ policy_id }) => {
      const p = await getPolicy(policy_id);
      if (!p) return json({ ok: false, error: 'not_found' });
      return json({
        ok: true, policy_id: p.id, status: p.status, provider_id: p.provider_id,
        coverage_usdt: Number(p.coverage_usdt), deadline_at: p.deadline_at, job_ref: p.job_ref,
        premium_tx: p.premium_tx, job_tx: p.job_tx,
        delivered: !!p.delivered_at,
        // The exact string the provider must personal_sign to attest delivery.
        attestation_message: p.job_tx ? attestationMessage(p.id, p.job_tx) : null,
      });
    }),
  );

  server.tool(
    'attest_delivery',
    'PROVIDER-ONLY. Prove you delivered the job: sign the policy\'s attestation_message (from get_policy) with the same wallet that received the job payment, and submit the signature. A valid attestation lapses the policy — no claim is paid. Silence until the deadline means the buyer is paid.',
    {
      policy_id: z.string().uuid(),
      signature: z.string().min(1).max(500).describe("EIP-191 (personal_sign) signature over the policy's attestation_message"),
    },
    guard(async ({ policy_id, signature }) => {
      const p = await getPolicy(policy_id);
      if (!p) return json({ ok: false, error: 'not_found' });
      if (p.status !== 'active') return json({ ok: false, error: `policy_${p.status}` });
      if (!p.job_tx) return json({ ok: false, error: 'policy_has_no_onchain_job' });
      if (p.delivered_at) return json({ ok: true, policy_id: p.id, delivered: true, note: 'Already attested.' });
      // After the deadline the buyer's claim is already owed; delivery can no longer undo it.
      if (Date.now() > new Date(p.deadline_at).getTime())
        return json({ ok: false, error: 'past_deadline' });

      const providerWallet = await getProviderWallet(p.provider_id);
      if (!providerWallet) return json({ ok: false, error: 'provider_wallet_unknown' });

      // The signature must come from the wallet that was actually paid for this job —
      // so the buyer cannot forge a delivery, and nobody can attest for someone else.
      const valid = await verifyDeliveryAttestation({
        policyId: p.id, jobTx: p.job_tx, providerWallet, signature,
      });
      if (!valid) return json({ ok: false, error: 'invalid_signature' });

      if (!(await attestDelivery(p.id, signature))) return json({ ok: false, error: 'policy_not_attestable' });
      return json({
        ok: true, policy_id: p.id, delivered: true,
        note: 'Delivery attested. This policy will lapse at its deadline with no claim.',
      });
    }),
  );
}

/** Money surface: only ever registered behind the API-key gate. */
export function registerPaidTools(server: Srv): void {
  server.tool(
    'bind_policy',
    "Bind a quoted policy to a real, already-settled job. Pay the tier's premium in USDT to the quote's pay_to address, then call this with that tx hash (premium_tx) and the tx hash of your own payment to the provider (job_tx). Both are verified onchain before the policy exists.",
    {
      quote_id: z.string().uuid(),
      tier: z.enum(['skiff', 'frigate', 'galleon']).optional()
        .describe("Coverage tier to bind; defaults to the quote's recommended tier"),
      job_tx: z.string().max(80).optional()
        .describe('Tx hash of your USDT payment to the provider — the job this policy covers. Required unless the server is in fixture mode.'),
      premium_tx: z.string().max(80).optional()
        .describe("Tx hash of your USDT premium payment to the quote's pay_to address. Required unless the server is in fixture mode."),
      job_ref: z.string().min(1).max(200).optional()
        .describe('Optional label for the job; defaults to job_tx.'),
      deadline_at: z.string().datetime().describe('ISO-8601 delivery deadline; max 7 days from now'),
    },
    guard(async ({ quote_id, tier, job_ref, job_tx, premium_tx, deadline_at }) => {
      const quote = await getOpenQuote(quote_id);
      if (!quote) return json({ ok: false, error: 'quote_not_open_or_expired' });

      // Per-wallet keys may only insure their own wallet: a stolen key cannot buy
      // coverage that pays anyone but itself. Master key (operator) is unrestricted.
      if (walletMismatch(quote.buyer_wallet))
        return json({ ok: false, error: 'buyer_wallet_mismatch' });

      const chosenTier = tier ?? quote.recommended_tier;
      const premiumUsdt = TIERS[chosenTier];

      const deadline = new Date(deadline_at);
      const maxDeadline = Date.now() + 7 * 24 * 3600 * 1000;
      if (deadline.getTime() <= Date.now() || deadline.getTime() > maxDeadline)
        return json({ ok: false, error: 'deadline_must_be_future_within_7_days' });

      // Off fixture mode real value moves, so nothing binds without onchain proof of both
      // legs: the buyer paid the provider (the job), and the buyer paid Lloyd (the premium).
      const needProof = proofRequired();
      if (needProof && (!job_tx || !premium_tx))
        return json({ ok: false, error: 'job_tx_and_premium_tx_required' });
      const jobRef = job_ref ?? job_tx;
      if (!jobRef) return json({ ok: false, error: 'job_ref_or_job_tx_required' });

      // Fraud gate (cheap, DB-only) runs before any RPC round trip.
      const providerWallet = await getProviderWallet(quote.provider_id);
      const verdict = assessFraud({
        buyerWallet: quote.buyer_wallet,
        providerWallet,
        linkedToBuyer: await isLinked(quote.provider_id, quote.buyer_wallet),
        requireOnchainProof: needProof,
        ...(await getFraudContext(quote.buyer_wallet, quote.provider_id)),
      });
      if (!verdict.ok) return json({ ok: false, error: verdict.reason });

      // Coverage is recomputed deterministically for the chosen tier; the pre-bind
      // canBind below is the only provider-exposure gate (the store's post-insert
      // recheck backstops pool utilization only).
      const newCoverageUsdt = coverageForTier(
        chosenTier, quote.risk_class, Number(quote.job_value_usdt), quote.newcomer,
      );
      const ctx = await getBindContext(quote.buyer_wallet, quote.provider_id);
      const check = canBind({
        ...ctx,
        newCoverageUsdt,
        killSwitch: process.env.KILL_SWITCH === 'true',
      });
      if (!check.ok) return json({ ok: false, error: check.reason });

      if (needProof) {
        // Leg 1 — the job is real. A USDT payment of at least the quoted job value, from
        // this buyer to this provider's actual wallet. This is what makes a fabricated job
        // impossible: you cannot fake a settled transfer.
        const job = await verifyUsdtTransfer(job_tx!, {
          from: quote.buyer_wallet, to: providerWallet!, minUsdt: Number(quote.job_value_usdt),
        });
        if (!job.ok) return json({ ok: false, error: `job_payment_unverified:${job.reason}` });
        if (job.at.getTime() > deadline.getTime())
          return json({ ok: false, error: 'job_payment_after_deadline' });

        // Leg 2 — the premium is actually collected, in USDT, into the treasury the
        // Ledger's reserve is read from.
        const prem = await verifyUsdtTransfer(premium_tx!, {
          from: quote.buyer_wallet, to: TREASURY[activeNetwork()].address, minUsdt: premiumUsdt,
        });
        if (!prem.ok) return json({ ok: false, error: `premium_unverified:${prem.reason}` });
      }

      try {
        const policy = await bindQuote(quote_id, chosenTier, jobRef, deadline.toISOString(), {
          premiumTx: premium_tx, jobTx: job_tx,
        });
        return json({
          ok: true, policy_id: policy.id, tier: chosenTier,
          coverage_usdt: Number(policy.coverage_usdt),
          premium_usdt: Number(policy.premium_usdt), deadline_at: policy.deadline_at,
          premium_tx: policy.premium_tx, job_tx: policy.job_tx,
          certificate: `Lloyd policy ${policy.id}: covers ${policy.coverage_usdt} USDT on job ${jobRef} for ${policy.buyer_wallet} until ${policy.deadline_at}.`,
          note: 'Pays out unless the provider attests delivery (attest_delivery) before deadline_at.',
        });
      } catch (e: unknown) {
        // Expected business failures — including the DB-enforced fraud gates — surface
        // by name; everything else is sanitized (H-7).
        const msg = e instanceof Error ? e.message : '';
        const expected = [
          'solvency_recheck_failed', 'job_already_insured', 'premium_tx_already_used',
          'active_policy_exists_for_pair', 'quote_already_bound', 'already_bound',
        ];
        const hit = expected.find((x) => msg.startsWith(x));
        if (hit) return json({ ok: false, error: hit });
        console.error('[mcp] bind_error', e);
        return json({ ok: false, error: 'bind_failed' });
      }
    }),
  );

  server.tool(
    'file_claim',
    'Manually file a claim on an active policy (normally settlement is automatic).',
    { policy_id: z.string().uuid() },
    guard(async ({ policy_id }) => {
      const p = await getPolicy(policy_id);
      if (!p) return json({ ok: false, error: 'not_found' });
      if (walletMismatch(p.buyer_wallet)) return json({ ok: false, error: 'not_your_policy' });
      if (p.status !== 'active') return json({ ok: false, error: `policy_${p.status}` });
      const claim = await openClaim(p.id, 'manual', Number(p.coverage_usdt));
      if (!claim) return json({ ok: false, error: 'claim_already_exists' });
      await markPolicy(p.id, 'claim_pending');
      return json({ ok: true, claim_id: claim.id, status: 'pending_review', note: 'Manual claims are verified against job state before payout by the settlement run.' });
    }),
  );
}
