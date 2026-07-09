import { supabaseAdmin as db } from '../db';
import { getDossier, isLinked } from '../store';
import type { JobMonitor, JobState, ReputationSource, Treasury } from './types';

export const dbReputationSource: ReputationSource = {
  async getProviderRecord(providerId, buyerWallet) {
    const rec = await getDossier(providerId);
    if (!rec) return null;
    return { ...rec, linkedToBuyer: await isLinked(providerId, buyerWallet) };
  },
};

export const dbJobMonitor: JobMonitor = {
  async getJobState(jobRef): Promise<JobState> {
    const { data, error } = await db.from('demo_jobs').select('state').eq('job_ref', jobRef).maybeSingle();
    if (error) throw error;
    return (data?.state as JobState) ?? 'pending';
  },
};

// ponytail: logs payouts to the ledger with a fake hash; real transfers arrive in Task 9
export const loggingTreasury: Treasury = {
  async sendUsdt(toWallet, amountUsdt, note) {
    const txHash = `fixture-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[treasury:fixture] send ${amountUsdt} USDT → ${toWallet} (${note}) tx=${txHash}`);
    return { txHash };
  },
};
