// app/api/mcp/[transport]/route.ts
import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { COVERAGE_RATIO, TIERS, coverageForTier, evaluateQuote } from '@/lib/underwrite/engine';
import { canBind } from '@/lib/treasury/solvency';
import { getReputationSource } from '@/lib/okx';
import {
  bindQuote, createQuote, getBindContext, getOpenQuote, getPolicy, markPolicy, openClaim,
} from '@/lib/store';

const json = (v: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(v) }] });

const handler = createMcpHandler(
  (server) => {
    server.tool(
      'get_quote',
      'Price delivery protection for hiring a provider agent. Returns three fixed-price tiers (skiff/frigate/galleon) with the coverage each buys, a recommended tier, and a 1-hour quote_id — or a decline with reason.',
      {
        provider_id: z.string().describe('OKX.AI agent id of the provider you intend to hire'),
        buyer_wallet: z.string().describe('Your wallet address — payout destination if a claim pays'),
        job_value_usdt: z.number().positive().describe('Agreed job value in USDT'),
        job_type: z.string().default('general').describe('Free-text job category'),
      },
      async ({ provider_id, buyer_wallet, job_value_usdt, job_type }) => {
        let record;
        try {
          record = await getReputationSource().getProviderRecord(provider_id, buyer_wallet);
        } catch {
          return json({ decision: 'decline', reason: 'data_unavailable' }); // decline, never guess
        }
        if (!record) return json({ decision: 'decline', reason: 'data_unavailable' });

        const decision = evaluateQuote(record, job_value_usdt);
        if (decision.decision === 'decline') return json(decision);

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
          terms: "Pays 80% of job value (up to the tier's coverage) if the job is not delivered by deadline_at or a dispute is ruled against the provider. Premium is the tier's fixed price.",
        });
      },
    );

    server.tool(
      'bind_policy',
      "Bind a quoted policy to a specific job at a chosen tier. This is the paid call — the tier's fixed price is the premium.",
      {
        quote_id: z.string().uuid(),
        tier: z.enum(['skiff', 'frigate', 'galleon']).optional()
          .describe("Coverage tier to bind; defaults to the quote's recommended tier"),
        job_ref: z.string().describe('The OKX.AI job/escrow reference this policy covers'),
        deadline_at: z.string().datetime().describe('ISO-8601 delivery deadline; max 7 days from now'),
      },
      async ({ quote_id, tier, job_ref, deadline_at }) => {
        const quote = await getOpenQuote(quote_id);
        if (!quote) return json({ ok: false, error: 'quote_not_open_or_expired' });

        const chosenTier = tier ?? quote.recommended_tier;

        const deadline = new Date(deadline_at);
        const maxDeadline = Date.now() + 7 * 24 * 3600 * 1000;
        if (deadline.getTime() <= Date.now() || deadline.getTime() > maxDeadline)
          return json({ ok: false, error: 'deadline_must_be_future_within_7_days' });

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

        try {
          const policy = await bindQuote(quote_id, chosenTier, job_ref, deadline.toISOString());
          return json({
            ok: true, policy_id: policy.id, tier: chosenTier,
            coverage_usdt: Number(policy.coverage_usdt),
            premium_usdt: Number(policy.premium_usdt), deadline_at: policy.deadline_at,
            certificate: `Lloyd policy ${policy.id}: covers ${policy.coverage_usdt} USDT on job ${job_ref} for ${policy.buyer_wallet} until ${policy.deadline_at}.`,
          });
        } catch (e: unknown) {
          // Includes 'solvency_recheck_failed' / 'solvency_recheck_failed_and_unwind_failed: …'
          return json({ ok: false, error: e instanceof Error ? e.message : 'bind_failed' });
        }
      },
    );

    server.tool(
      'get_policy',
      'Check the status of a Lloyd policy.',
      { policy_id: z.string().uuid() },
      async ({ policy_id }) => {
        const p = await getPolicy(policy_id);
        if (!p) return json({ ok: false, error: 'not_found' });
        return json({
          ok: true, policy_id: p.id, status: p.status, provider_id: p.provider_id,
          coverage_usdt: Number(p.coverage_usdt), deadline_at: p.deadline_at, job_ref: p.job_ref,
        });
      },
    );

    server.tool(
      'file_claim',
      'Manually file a claim on an active policy (normally settlement is automatic).',
      { policy_id: z.string().uuid() },
      async ({ policy_id }) => {
        const p = await getPolicy(policy_id);
        if (!p) return json({ ok: false, error: 'not_found' });
        if (p.status !== 'active') return json({ ok: false, error: `policy_${p.status}` });
        const claim = await openClaim(p.id, 'manual', Number(p.coverage_usdt));
        if (!claim) return json({ ok: false, error: 'claim_already_exists' });
        await markPolicy(p.id, 'claim_pending');
        return json({ ok: true, claim_id: claim.id, status: 'pending_review', note: 'Manual claims are verified against job state before payout by the settlement run.' });
      },
    );
  },
  undefined,
  // mcp-handler matches url.pathname === endpoint EXACTLY (verified in dist/index.js:279),
  // so the default '/mcp' would 404 at this route's real path. basePath derives
  // '/api/mcp/mcp' (streamable HTTP), '/api/mcp/sse', '/api/mcp/message'.
  { basePath: '/api/mcp' },
);

export { handler as GET, handler as POST, handler as DELETE };
