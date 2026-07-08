import type { JobMonitor, Treasury } from '../okx/types';
import { decideSettlement } from './decide';
import {
  getActivePolicies, getPendingClaims, getPolicy, markClaimPaid, markPolicy, openClaim,
} from '../store';

export interface SettlementReport {
  checked: number;
  paidOut: string[];
  expired: string[];
  errors: { policyId: string; error: string }[];
}

export async function runSettlement(
  jobs: JobMonitor, treasury: Treasury, now: Date = new Date(),
): Promise<SettlementReport> {
  const report: SettlementReport = { checked: 0, paidOut: [], expired: [], errors: [] };

  // Pass 1: active policies → decide → open claims / expire
  for (const p of await getActivePolicies()) {
    report.checked++;
    try {
      const state = await jobs.getJobState(p.job_ref);
      const action = decideSettlement(state, new Date(p.deadline_at), now);
      if (action === 'wait') continue;
      if (action === 'expire') { await markPolicy(p.id, 'expired'); report.expired.push(p.id); continue; }
      const trigger = action === 'payout_dispute' ? 'dispute_verdict' : 'delivery_timeout';
      const claim = await openClaim(p.id, trigger, Number(p.coverage_usdt)); // null if already claimed (pays-once)
      if (claim) await markPolicy(p.id, 'claim_pending');
    } catch (e) {
      report.errors.push({ policyId: p.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  // Pass 2: pending claims → pay (this IS the retry queue: failures stay pending)
  for (const c of await getPendingClaims()) {
    try {
      const policy = await getPolicy(c.policy_id);
      if (!policy) continue;
      if (c.trigger === 'manual') {
        // manual claims are verified against job state before paying
        const state = await jobs.getJobState(policy.job_ref);
        const action = decideSettlement(state, new Date(policy.deadline_at), now);
        if (action !== 'payout_dispute' && action !== 'payout_timeout') continue; // not (yet) payable
      }
      const { txHash } = await treasury.sendUsdt(
        policy.buyer_wallet, Number(c.amount_usdt), `Lloyd claim ${c.id} on policy ${policy.id}`,
      );
      await markClaimPaid(c.id, txHash);
      await markPolicy(policy.id, 'paid_out');
      report.paidOut.push(policy.id);
    } catch (e) {
      report.errors.push({ policyId: c.policy_id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return report;
}
