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

export const jobMonitor: JobMonitor = {
  async getJobState(policy): Promise<JobState> {
    // Real flow — the policy is anchored to an onchain job payment, so the provider's
    // signed attestation is the oracle: signed = delivered, silent = still pending (and
    // decideSettlement turns pending-past-deadline into a payout).
    if (policy.job_tx) return policy.delivered_at ? 'delivered' : 'pending';

    // Demo flow — job state comes from the seeded demo_jobs table.
    const { data, error } = await db.from('demo_jobs').select('state').eq('job_ref', policy.job_ref).maybeSingle();
    if (error) throw error;
    // Fail CLOSED (C-4): an unknown job_ref (no row) must never be payable. A phantom or
    // unverified reference resolves to 'delivered' → 'expire' in decideSettlement, so it
    // cannot trigger a payout on timeout. Only a job we actually track can pay out.
    if (!data) return 'delivered';
    return data.state as JobState;
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
