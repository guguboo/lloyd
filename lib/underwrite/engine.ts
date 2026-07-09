import type { ProviderRecord, QuoteDecision, RiskClass, Tier } from './types';

export const RATES: Record<RiskClass, number> = { A: 0.03, B: 0.07, C: 0.15 };
export const TIERS: Record<Tier, number> = { skiff: 0.75, frigate: 1.5, galleon: 3.5 };
export const COVERAGE_RATIO = 0.8;
export const MAX_COVERAGE_USDT = 50;
export const NEWCOMER_MAX_COVERAGE_USDT = 10;

export const round2 = (n: number) => Math.round(n * 100) / 100;

const downgrade = (c: RiskClass): RiskClass => (c === 'A' ? 'B' : 'C');

/** Coverage (USDT) a fixed-price tier buys: premium / rate, capped by 80% co-insurance and the per-policy cap. */
export function coverageForTier(
  tier: Tier,
  riskClass: RiskClass,
  jobValueUsdt: number,
  newcomer: boolean,
): number {
  const cap = newcomer ? NEWCOMER_MAX_COVERAGE_USDT : MAX_COVERAGE_USDT;
  return round2(Math.min(TIERS[tier] / RATES[riskClass], COVERAGE_RATIO * jobValueUsdt, cap));
}

export function evaluateQuote(rec: ProviderRecord, jobValueUsdt: number): QuoteDecision {
  if (!Number.isFinite(jobValueUsdt) || jobValueUsdt <= 0)
    return { decision: 'decline', reason: 'invalid_job_value' };

  const dataUsable =
    Number.isFinite(rec.walletAgeDays) &&
    Number.isFinite(rec.completedJobs) &&
    Number.isFinite(rec.totalVolumeUsdt) &&
    Number.isFinite(rec.disputeRate) &&
    rec.disputeRate >= 0 &&
    rec.disputeRate <= 1 &&
    (rec.avgRating === null || Number.isFinite(rec.avgRating));
  if (!dataUsable) return { decision: 'decline', reason: 'data_unavailable' };

  if (rec.linkedToBuyer) return { decision: 'decline', reason: 'linked_wallets' };
  if (rec.disputeRate > 0.25) return { decision: 'decline', reason: 'high_dispute_rate' };

  const newcomer = rec.completedJobs < 3 || rec.walletAgeDays < 7;

  let riskClass: RiskClass;
  if (newcomer) riskClass = 'C';
  else if (rec.completedJobs >= 50 && rec.walletAgeDays >= 30) riskClass = 'A';
  else riskClass = 'B';

  if (!newcomer && rec.disputeRate > 0.1) riskClass = downgrade(riskClass);
  if (!newcomer && rec.avgRating !== null && rec.avgRating < 3.5) riskClass = downgrade(riskClass);

  const tiers: Record<Tier, number> = {
    skiff: coverageForTier('skiff', riskClass, jobValueUsdt, newcomer),
    frigate: coverageForTier('frigate', riskClass, jobValueUsdt, newcomer),
    galleon: coverageForTier('galleon', riskClass, jobValueUsdt, newcomer),
  };

  // Coverage is non-decreasing in tier price, so the max is always achieved by
  // galleon; recommend the CHEAPEST tier that ties it.
  const maxCoverage = Math.max(tiers.skiff, tiers.frigate, tiers.galleon);
  const recommendedTier: Tier =
    tiers.skiff === maxCoverage ? 'skiff' : tiers.frigate === maxCoverage ? 'frigate' : 'galleon';

  return { decision: 'quote', riskClass, newcomer, tiers, recommendedTier };
}
