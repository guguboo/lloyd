import { supabaseAdmin as db } from './db';
import type { ProviderRecord, RiskClass, Tier } from './underwrite/types';
import { TIERS, coverageForTier } from './underwrite/engine';

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
}
export interface ClaimRow {
  id: string; policy_id: string; trigger: 'dispute_verdict' | 'delivery_timeout' | 'manual';
  amount_usdt: number; status: 'pending' | 'paid'; tx_hash: string | null; created_at: string;
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

export async function bindQuote(quoteId: string, tier: Tier, jobRef: string, deadlineAt: string): Promise<PolicyRow> {
  const quote = await getOpenQuote(quoteId);
  if (!quote) throw new Error('quote_not_open');
  // Fixed-price tiers: premium is the tier's listed price; coverage is recomputed
  // deterministically at bind (the newcomer flag is required for the $10 cap).
  const premium = TIERS[tier];
  const coverage = coverageForTier(tier, quote.risk_class, Number(quote.job_value_usdt), quote.newcomer);
  // Unique(quote_id) on policies is the atomic single-use gate.
  const { data: policy, error } = await db.from('policies').insert({
    quote_id: quote.id, provider_id: quote.provider_id, buyer_wallet: quote.buyer_wallet,
    job_ref: jobRef, job_value_usdt: quote.job_value_usdt, tier, coverage_usdt: coverage,
    premium_usdt: premium, deadline_at: deadlineAt,
  }).select('*').single();
  if (error) throw error;
  await db.from('quotes').update({ status: 'bound' }).eq('id', quote.id);
  const { error: ledgerErr } = await db.from('ledger_events').insert({
    kind: 'premium', amount_usdt: premium, policy_id: policy.id,
    note: `premium for policy ${policy.id}`,
  });
  if (ledgerErr) throw ledgerErr;
  return policy as PolicyRow;
}

export async function getPolicy(policyId: string): Promise<PolicyRow | null> {
  const { data, error } = await db.from('policies').select('*').eq('id', policyId).maybeSingle();
  if (error) throw error;
  return data as PolicyRow | null;
}

export async function getBindContext(buyerWallet: string, providerId: string) {
  const [{ data: ledger }, { data: active }, { data: claims }] = await Promise.all([
    db.from('ledger_events').select('amount_usdt'),
    db.from('policies').select('provider_id, buyer_wallet, coverage_usdt').in('status', ['active', 'claim_pending']),
    db.from('claims').select('id, status, paid_at, policies!inner(buyer_wallet)')
      .eq('status', 'paid').eq('policies.buyer_wallet', buyerWallet)
      .gte('paid_at', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()),
  ]);
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

export async function markClaimPaid(claimId: string, txHash: string): Promise<void> {
  const { data: claim, error } = await db.from('claims')
    .update({ status: 'paid', tx_hash: txHash, paid_at: new Date().toISOString() })
    .eq('id', claimId).select('policy_id, amount_usdt').single();
  if (error) throw error;
  const { error: e2 } = await db.from('ledger_events').insert({
    kind: 'payout', amount_usdt: -num(claim.amount_usdt), policy_id: claim.policy_id, tx_hash: txHash,
  });
  if (e2) throw e2;
}

export async function markPolicy(policyId: string, status: PolicyStatus): Promise<void> {
  const { error } = await db.from('policies').update({ status }).eq('id', policyId);
  if (error) throw error;
}

export async function getLedgerStats() {
  const [{ data: ledger }, { count: written }, { count: paid }] = await Promise.all([
    db.from('ledger_events').select('amount_usdt, kind'),
    db.from('policies').select('id', { count: 'exact', head: true }),
    db.from('claims').select('id', { count: 'exact', head: true }).eq('status', 'paid'),
  ]);
  const rows = ledger ?? [];
  const { data: active } = await db.from('policies')
    .select('coverage_usdt').in('status', ['active', 'claim_pending']);
  return {
    poolUsdt: rows.reduce((s, r) => s + num(r.amount_usdt), 0),
    outstandingUsdt: (active ?? []).reduce((s, r) => s + num(r.coverage_usdt), 0),
    policiesWritten: written ?? 0,
    claimsPaid: paid ?? 0,
  };
}

export async function recentActivity() {
  const [{ data: policies }, { data: claims }] = await Promise.all([
    db.from('policies').select('*').order('created_at', { ascending: false }).limit(20),
    db.from('claims').select('*').order('created_at', { ascending: false }).limit(20),
  ]);
  return { policies: (policies ?? []) as PolicyRow[], claims: (claims ?? []) as ClaimRow[] };
}
