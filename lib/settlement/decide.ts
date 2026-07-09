import type { JobState } from '../okx/types';

export type SettlementAction = 'payout_dispute' | 'payout_timeout' | 'expire' | 'wait';

// Trigger priority per spec §10: dispute verdict first, then timeout.
export function decideSettlement(jobState: JobState, deadlineAt: Date, now: Date): SettlementAction {
  if (jobState === 'provider_fault') return 'payout_dispute';
  if (jobState === 'delivered') return 'expire';
  if (now.getTime() > deadlineAt.getTime()) return 'payout_timeout';
  return 'wait';
}
