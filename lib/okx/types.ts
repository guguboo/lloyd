import type { ProviderRecord } from '../underwrite/types';
import type { PolicyRow } from '../store';

export interface ReputationSource {
  getProviderRecord(providerId: string, buyerWallet: string): Promise<ProviderRecord | null>;
}

export type JobState = 'pending' | 'delivered' | 'provider_fault';

export interface JobMonitor {
  /** Takes the whole policy: a real job's state lives on the policy (attestation), a demo job's in demo_jobs. */
  getJobState(policy: PolicyRow): Promise<JobState>;
}

export interface Treasury {
  sendUsdt(toWallet: string, amountUsdt: number, note: string): Promise<{ txHash: string }>;
  /**
   * Optional funds/gas check run BEFORE the pays-once CAS. A predictable shortfall
   * (not enough USDT or gas) returns { ok: false } so the claim stays 'pending' and
   * retries next run, instead of being moved to 'sending' and wedged (see run.ts / D7).
   */
  preflight?(amountUsdt: number): Promise<{ ok: boolean; reason?: string }>;
}
