export type RiskClass = 'A' | 'B' | 'C';

export type Tier = 'skiff' | 'frigate' | 'galleon';

export type DeclineReason =
  | 'linked_wallets'
  | 'high_dispute_rate'
  | 'data_unavailable'
  | 'invalid_job_value';

export interface ProviderRecord {
  providerId: string;
  walletAgeDays: number;
  completedJobs: number;
  totalVolumeUsdt: number;
  disputeRate: number;        // 0..1
  avgRating: number | null;   // 1..5, null if unrated
  linkedToBuyer: boolean;     // computed against the quoting buyer
}

export type QuoteDecision =
  | {
      decision: 'quote';
      riskClass: RiskClass;
      newcomer: boolean;
      tiers: Record<Tier, number>;   // coverage (USDT) each tier buys
      recommendedTier: Tier;         // cheapest tier reaching max achievable coverage
    }
  | { decision: 'decline'; reason: DeclineReason };
