import type { ProviderRecord } from '../underwrite/types';

export interface ReputationSource {
  getProviderRecord(providerId: string, buyerWallet: string): Promise<ProviderRecord | null>;
}

export type JobState = 'pending' | 'delivered' | 'provider_fault';

export interface JobMonitor {
  getJobState(jobRef: string): Promise<JobState>;
}

export interface Treasury {
  sendUsdt(toWallet: string, amountUsdt: number, note: string): Promise<{ txHash: string }>;
}
