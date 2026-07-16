import { supabaseAdmin as db } from './db';
import type { ProviderRecord, RiskClass, Tier } from './underwrite/types';
import { TIERS, coverageForTier } from './underwrite/engine';
import { MAX_POOL_UTILIZATION } from '@/lib/treasury/solvency';

export type PolicyStatus = 'active' | 'expired' | 'claim_pending' | 'paid_out';

export interface QuoteRow {
  id: string; provider_id: string; buyer_wallet: string; job_value_usdt: number;
  job_type: string; risk_class: RiskClass; recommended_tier: Tier; newcomer: boolean;
  status: 'open' | 'bound'; expires_at: string;
}
export interface PolicyRow {
  id: string; quote_id: string; provider_id: string; buyer_wallet: string;
  job_ref: string; job_value_usdt: number; tier: Tier; coverage_usdt: number; premium_usdt: number;
  deadline_at: string; status: PolicyStatus; created_at: string;
  // Onchain anchors + the provider's delivery attestation (migration 005). Null on demo
  // policies, which are settled from demo_jobs instead.
  premium_tx: string | null; job_tx: string | null;
  delivered_at: string | null; delivery_sig: string | null;
}
export interface ClaimRow {
  id: string; policy_id: string; trigger: 'dispute_verdict' | 'delivery_timeout' | 'manual';
  amount_usdt: number; status: 'pending' | 'sending' | 'paid'; tx_hash: string | null; created_at: string;
}

const num = (v: unknown) => Number(v); // supabase returns numeric as string

export async function getDossier(providerId: string): Promise<ProviderRecord | null> {
  const { data, error } = await db.from('provider_dossiers').select('*').eq('provider_id', providerId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    providerId: data.provider_id,
    walletAgeDays: data.wallet_age_days,
    completedJobs: data.completed_jobs,
    totalVolumeUsdt: num(data.total_volume_usdt),
    disputeRate: num(data.dispute_rate),
    avgRating: data.avg_rating === null ? null : num(data.avg_rating),
    linkedToBuyer: false,
  };
}

/** The provider's payout address — the recipient a job payment must actually have gone to. */
export async function getProviderWallet(providerId: string): Promise<string | null> {
  const { data, error } = await db.from('provider_dossiers')
    .select('wallet').eq('provider_id', providerId).maybeSingle();
  if (error) throw error;
  return data?.wallet ?? null;
}

export async function isLinked(providerId: string, buyerWallet: string): Promise<boolean> {
  const { data, error } = await db.from('provider_dossiers')
    .select('linked_wallets').eq('provider_id', providerId).maybeSingle();
  if (error) throw error;
  return !!data?.linked_wallets?.includes(buyerWallet);
}

export async function createQuote(q: {
  providerId: string; buyerWallet: string; jobValueUsdt: number; jobType: string;
  riskClass: RiskClass; newcomer: boolean; recommendedTier: Tier;
}): Promise<{ id: string; expiresAt: string }> {
  const { data, error } = await db.from('quotes').insert({
    provider_id: q.providerId, buyer_wallet: q.buyerWallet, job_value_usdt: q.jobValueUsdt,
    job_type: q.jobType, risk_class: q.riskClass, recommended_tier: q.recommendedTier, newcomer: q.newcomer,
  }).select('id, expires_at').single();
  if (error) throw error;
  return { id: data.id, expiresAt: data.expires_at };
}

export async function getOpenQuote(quoteId: string): Promise<QuoteRow | null> {
  const { data, error } = await db.from('quotes').select('*')
    .eq('id', quoteId).eq('status', 'open').gt('expires_at', new Date().toISOString()).maybeSingle();
  if (error) throw error;
  return data as QuoteRow | null;
}

// Which uniqueness gate a 23505 tripped. These are the DB-enforced fraud controls, so the
// caller gets the precise reason rather than a generic bind failure.
function uniqueViolation(message: string): string | null {
  if (message.includes('policies_job_tx_uniq')) return 'job_already_insured';
  if (message.includes('policies_premium_tx_uniq')) return 'premium_tx_already_used';
  if (message.includes('one_active_policy_per_pair')) return 'active_policy_exists_for_pair';
  if (message.includes('quote_id')) return 'quote_already_bound';
  return null;
}

export async function bindQuote(
  quoteId: string, tier: Tier, jobRef: string, deadlineAt: string,
  // The onchain anchors, already verified by the caller. Null in fixture mode (no value moves).
  proof: { premiumTx?: string; jobTx?: string } = {},
): Promise<PolicyRow> {
  const quote = await getOpenQuote(quoteId);
  if (!quote) throw new Error('quote_not_open');
  // Fixed-price tiers: premium is the tier's listed price; coverage is recomputed
  // deterministically at bind (the newcomer flag is required for the $10 cap).
  const premium = TIERS[tier];
  const coverage = coverageForTier(tier, quote.risk_class, Number(quote.job_value_usdt), quote.newcomer);
  const premiumTx = proof.premiumTx?.toLowerCase() ?? null;
  const jobTx = proof.jobTx?.toLowerCase() ?? null;
  // Unique(quote_id) is the single-use gate; unique(job_tx)/unique(premium_tx) are the
  // double-insurance and premium-reuse gates. All three are atomic, in the DB.
  const { data: policy, error } = await db.from('policies').insert({
    quote_id: quote.id, provider_id: quote.provider_id, buyer_wallet: quote.buyer_wallet,
    job_ref: jobRef, job_value_usdt: quote.job_value_usdt, tier, coverage_usdt: coverage,
    premium_usdt: premium, deadline_at: deadlineAt, premium_tx: premiumTx, job_tx: jobTx,
  }).select('*').single();
  if (error) {
    if (error.code === '23505') throw new Error(uniqueViolation(error.message) ?? 'already_bound');
    throw error;
  }
  // Over-commit recheck: re-read outstanding coverage (incl. this just-inserted policy) vs pool
  // BEFORE any money event, so the compensating delete undoes the insert cleanly if we breach.
  // ponytail: optimistic recheck, not serialization — the residual race is both concurrent
  // rechecks passing (over-commit); the recheck narrows the window to insert→recheck, it does
  // not close it. Advisory locks if bind volume ever matters.
  const [{ data: activeRows, error: activeErr }, { data: ledgerRows, error: ledgerReadErr }] = await Promise.all([
    db.from('policies').select('coverage_usdt').in('status', ['active', 'claim_pending']),
    db.from('ledger_events').select('amount_usdt'),
  ]);
  if (activeErr) throw activeErr;
  if (ledgerReadErr) throw ledgerReadErr;
  const outstanding = (activeRows ?? []).reduce((s, r) => s + num(r.coverage_usdt), 0);
  const pool = (ledgerRows ?? []).reduce((s, r) => s + num(r.amount_usdt), 0);
  if (outstanding > MAX_POOL_UTILIZATION * pool) {
    // supabase-js does not throw — an unchecked failed delete would leave an over-cap
    // policy active with no premium. That must be loud, never silent.
    const { error: unwindErr } = await db.from('policies').delete().eq('id', policy.id);
    if (unwindErr) throw new Error('solvency_recheck_failed_and_unwind_failed: ' + unwindErr.message);
    throw new Error('solvency_recheck_failed');
  }
  await db.from('quotes').update({ status: 'bound' }).eq('id', quote.id);
  // The premium enters the pool only now, carrying the tx that actually paid it — so the
  // book's capital is the capital the treasury really received, verifiable onchain.
  const { error: ledgerErr } = await db.from('ledger_events').insert({
    kind: 'premium', amount_usdt: premium, policy_id: policy.id, tx_hash: premiumTx,
    note: `premium for policy ${policy.id}`,
  });
  if (ledgerErr) throw ledgerErr;
  return policy as PolicyRow;
}

/**
 * Record the provider's signed delivery attestation (signature already verified).
 * Guarded: only ever attests an ACTIVE, not-yet-attested policy, so it can neither
 * un-fail a policy that already claimed nor be replayed.
 */
export async function attestDelivery(policyId: string, signature: string): Promise<boolean> {
  const { data, error } = await db.from('policies')
    .update({ delivered_at: new Date().toISOString(), delivery_sig: signature })
    .eq('id', policyId).eq('status', 'active').is('delivered_at', null)
    .select('id').maybeSingle();
  if (error) throw error;
  return !!data;
}

/** Bind-time fraud signals for this buyer + provider pair (see lib/fraud.ts). */
export async function getFraudContext(buyerWallet: string, providerId: string) {
  const [
    { data: buyerPolicies, error: policiesErr },
    { data: pairClaims, error: pairErr },
  ] = await Promise.all([
    db.from('policies').select('id, status').eq('buyer_wallet', buyerWallet),
    db.from('claims').select('id, policies!inner(buyer_wallet, provider_id)')
      .eq('status', 'paid').eq('policies.buyer_wallet', buyerWallet).eq('policies.provider_id', providerId),
  ]);
  if (policiesErr) throw policiesErr;
  if (pairErr) throw pairErr;
  const rows = buyerPolicies ?? [];
  return {
    buyerPolicies: rows.length,
    buyerPaidClaims: rows.filter((r) => r.status === 'paid_out').length,
    pairPaidClaims: (pairClaims ?? []).length,
  };
}

export async function getPolicy(policyId: string): Promise<PolicyRow | null> {
  const { data, error } = await db.from('policies').select('*').eq('id', policyId).maybeSingle();
  if (error) throw error;
  return data as PolicyRow | null;
}

export async function getBindContext(buyerWallet: string, providerId: string) {
  const [
    { data: ledger, error: ledgerErr },
    { data: active, error: activeErr },
    { data: claims, error: claimsErr },
  ] = await Promise.all([
    db.from('ledger_events').select('amount_usdt'),
    db.from('policies').select('provider_id, buyer_wallet, coverage_usdt').in('status', ['active', 'claim_pending']),
    db.from('claims').select('id, status, paid_at, policies!inner(buyer_wallet)')
      .eq('status', 'paid').eq('policies.buyer_wallet', buyerWallet)
      .gte('paid_at', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()),
  ]);
  if (ledgerErr) throw ledgerErr;
  if (activeErr) throw activeErr;
  if (claimsErr) throw claimsErr;
  const poolUsdt = (ledger ?? []).reduce((s, r) => s + num(r.amount_usdt), 0);
  const rows = active ?? [];
  return {
    poolUsdt,
    outstandingUsdt: rows.reduce((s, r) => s + num(r.coverage_usdt), 0),
    providerOutstandingUsdt: rows.filter(r => r.provider_id === providerId)
      .reduce((s, r) => s + num(r.coverage_usdt), 0),
    buyerPaidClaims7d: (claims ?? []).length,
    buyerHasActivePolicyWithProvider: rows.some(r => r.buyer_wallet === buyerWallet && r.provider_id === providerId),
  };
}

export async function getActivePolicies(): Promise<PolicyRow[]> {
  const { data, error } = await db.from('policies').select('*').eq('status', 'active');
  if (error) throw error;
  return (data ?? []) as PolicyRow[];
}

export async function getPendingClaims(): Promise<ClaimRow[]> {
  const { data, error } = await db.from('claims').select('*').eq('status', 'pending');
  if (error) throw error;
  return (data ?? []) as ClaimRow[];
}

// D7: claims stuck in 'sending' are the crash-window fail-safe state — a prior run
// moved the claim to 'sending', sent (or crashed around) the on-chain transfer, and
// died before markClaimPaid. The transfer outcome is unknown, so these are NEVER
// auto-retried; the executor surfaces them for an operator on-chain check.
export async function getStuckSendingClaims(): Promise<ClaimRow[]> {
  const { data, error } = await db.from('claims').select('*').eq('status', 'sending');
  if (error) throw error;
  return (data ?? []) as ClaimRow[];
}

export async function openClaim(
  policyId: string, trigger: ClaimRow['trigger'], amountUsdt: number,
): Promise<ClaimRow | null> {
  const { data, error } = await db.from('claims')
    .insert({ policy_id: policyId, trigger, amount_usdt: amountUsdt }).select('*').single();
  if (error) {
    if (error.code === '23505') return null; // unique_violation → already claimed: pays-once
    throw error;
  }
  return data as ClaimRow;
}

// D7 phase 1: move a claim pending -> sending BEFORE the on-chain transfer.
// Guarded CAS: returns true iff this call transitioned a still-pending claim
// (so the caller owns the send). Returns false if zero rows matched — the claim
// is already 'sending' (a prior crashed run) or 'paid'; either way this run must
// NOT send. Throws on any DB error.
export async function markClaimSending(claimId: string): Promise<boolean> {
  const { data, error } = await db.from('claims')
    .update({ status: 'sending' })
    .eq('id', claimId).eq('status', 'pending').select('id').maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function markClaimPaid(claimId: string, txHash: string): Promise<void> {
  const { data: claim, error } = await db.from('claims')
    .update({ status: 'paid', tx_hash: txHash, paid_at: new Date().toISOString() })
    .eq('id', claimId).in('status', ['pending', 'sending']).select('policy_id, amount_usdt').maybeSingle();
  if (error) throw error;
  if (!claim) {
    // Zero rows updated: claim missing, or already paid. Self-heal the case where a prior
    // attempt committed the UPDATE but died before the ledger insert (would under-debit forever).
    const { data: existing, error: lookupErr } = await db.from('claims')
      .select('policy_id, amount_usdt, status').eq('id', claimId).maybeSingle();
    if (lookupErr) throw lookupErr;
    if (!existing) throw new Error('claim_not_found');
    if (existing.status === 'paid') {
      const { error: healErr } = await db.from('ledger_events').insert({
        kind: 'payout', amount_usdt: -num(existing.amount_usdt), policy_id: existing.policy_id, tx_hash: txHash,
      });
      // one_payout_per_policy makes 23505 an exact "already debited" signal → idempotent success.
      if (healErr && healErr.code !== '23505') throw healErr;
    }
    return;
  }
  const { error: e2 } = await db.from('ledger_events').insert({
    kind: 'payout', amount_usdt: -num(claim.amount_usdt), policy_id: claim.policy_id, tx_hash: txHash,
  });
  if (e2) {
    if (e2.code === '23505') return; // payout already ledgered (one_payout_per_policy) — mirror openClaim
    throw e2;
  }
}

export async function markPolicy(policyId: string, status: PolicyStatus): Promise<void> {
  const { error } = await db.from('policies').update({ status }).eq('id', policyId);
  if (error) throw error;
}

// Operator recovery for a claim wedged in 'sending' (H-2). Only ever acts on a 'sending'
// claim. 'paid': finalize with the operator-confirmed on-chain tx (markClaimPaid does the
// sending→paid transition + idempotent ledger). 'reset': nothing was sent → back to
// 'pending' so the next settlement run retries it.
export async function resolveStuckClaim(
  claimId: string, action: 'paid' | 'reset', txHash?: string,
): Promise<{ ok: boolean; policyId?: string }> {
  const { data: claim, error } = await db.from('claims')
    .select('policy_id, status').eq('id', claimId).maybeSingle();
  if (error) throw error;
  if (!claim) return { ok: false };
  if (claim.status !== 'sending') return { ok: false, policyId: claim.policy_id };
  if (action === 'reset') {
    const { data, error: e } = await db.from('claims')
      .update({ status: 'pending' }).eq('id', claimId).eq('status', 'sending').select('id').maybeSingle();
    if (e) throw e;
    return { ok: !!data, policyId: claim.policy_id };
  }
  if (!txHash) return { ok: false, policyId: claim.policy_id };
  await markClaimPaid(claimId, txHash);
  await markPolicy(claim.policy_id, 'paid_out');
  return { ok: true, policyId: claim.policy_id };
}

export async function getLedgerStats() {
  const [
    { data: ledger, error: ledgerErr },
    { count: written, error: writtenErr },
    { count: paid, error: paidErr },
  ] = await Promise.all([
    db.from('ledger_events').select('amount_usdt, kind'),
    db.from('policies').select('id', { count: 'exact', head: true }),
    db.from('claims').select('id', { count: 'exact', head: true }).eq('status', 'paid'),
  ]);
  if (ledgerErr) throw ledgerErr;
  if (writtenErr) throw writtenErr;
  if (paidErr) throw paidErr;
  const rows = ledger ?? [];
  const { data: active, error: activeErr } = await db.from('policies')
    .select('coverage_usdt').in('status', ['active', 'claim_pending']);
  if (activeErr) throw activeErr;
  return {
    poolUsdt: rows.reduce((s, r) => s + num(r.amount_usdt), 0),
    outstandingUsdt: (active ?? []).reduce((s, r) => s + num(r.coverage_usdt), 0),
    policiesWritten: written ?? 0,
    claimsPaid: paid ?? 0,
  };
}

export async function recentActivity() {
  const [
    { data: policies, error: policiesErr },
    { data: claims, error: claimsErr },
  ] = await Promise.all([
    db.from('policies').select('*').order('created_at', { ascending: false }).limit(20),
    db.from('claims').select('*').order('created_at', { ascending: false }).limit(20),
  ]);
  if (policiesErr) throw policiesErr;
  if (claimsErr) throw claimsErr;
  return { policies: (policies ?? []) as PolicyRow[], claims: (claims ?? []) as ClaimRow[] };
}

/** Absolute USDT paid out since UTC midnight — the daily-cap denominator. */
export async function getTodayPayoutsUsdt(): Promise<number> {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { data, error } = await db.from('ledger_events')
    .select('amount_usdt').eq('kind', 'payout').gte('created_at', dayStart.toISOString());
  if (error) throw error;
  return (data ?? []).reduce((s, r) => s + Math.abs(num(r.amount_usdt)), 0);
}
