import type { JobMonitor, Treasury } from '../okx/types';
import { decideSettlement } from './decide';
import {
  getActivePolicies, getPendingClaims, getStuckSendingClaims, getPolicy,
  markClaimSending, markClaimPaid, markPolicy, openClaim, getTodayPayoutsUsdt,
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

  // Settlement kill switch (M-6): halt ALL settlement instantly on an incident, without
  // pulling the cron. Distinct from KILL_SWITCH, which only blocks new binds.
  if (process.env.SETTLEMENT_PAUSED === 'true') return report;

  // Pass 1: active policies → decide → open claims / expire
  for (const p of await getActivePolicies()) {
    report.checked++;
    try {
      const state = await jobs.getJobState(p);
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

  // D7 fail-safe: claims already in 'sending' at run start are the crash-window
  // residue (a prior run sent-or-crashed, then died before finalizing). Their
  // on-chain outcome is unknown, so we NEVER auto-resend — we surface them for an
  // operator to check on-chain. getPendingClaims() returns only 'pending', so these
  // are excluded from the auto-pay loop by construction.
  for (const c of await getStuckSendingClaims()) {
    report.errors.push({ policyId: c.policy_id, error: 'stuck_sending' });
  }

  // Pass 2: pending claims → pay (this IS the retry queue: failures before markClaimSending
  // stay 'pending' and are retried next run; a throw after markClaimSending instead leaves
  // the claim 'sending' — surfaced above as stuck_sending, deliberately not auto-retried)
  for (const c of await getPendingClaims()) {
    try {
      const policy = await getPolicy(c.policy_id);
      if (!policy) continue;
      if (c.trigger === 'manual') {
        // manual claims are verified against job state before paying — this stays
        // BEFORE the pending→sending transition: never move a claim to 'sending'
        // unless it is actually payable right now.
        const state = await jobs.getJobState(policy);
        const action = decideSettlement(state, new Date(policy.deadline_at), now);
        if (action !== 'payout_dispute' && action !== 'payout_timeout') continue; // not (yet) payable
      }
      // Daily spend ceiling (ops backstop): a runaway day stops at the cap instead of
      // draining to the solvency limit. Re-read per claim so payouts landing within
      // this run count. Claim stays 'pending' — retries after UTC midnight.
      const cap = Number(process.env.TREASURY_DAILY_CAP_USDT ?? 25);
      const spentToday = await getTodayPayoutsUsdt();
      if (spentToday + Number(c.amount_usdt) > cap) {
        report.errors.push({ policyId: c.policy_id, error: 'daily_spend_cap_reached' });
        continue;
      }
      // Pre-flight funds/gas BEFORE the CAS. A proven shortfall leaves the claim
      // 'pending' (retried next run once the treasury is topped up) instead of moving it
      // to 'sending' where a failed transfer would wedge it (H-3).
      if (treasury.preflight) {
        const pf = await treasury.preflight(Number(c.amount_usdt));
        if (!pf.ok) { report.errors.push({ policyId: c.policy_id, error: `preflight:${pf.reason ?? 'not_ok'}` }); continue; }
      }
      // D7 phase 1: CAS pending→sending. If false, another run/actor already moved
      // this claim past 'pending' — do NOT send (fail-safe against double-send).
      if (!(await markClaimSending(c.id))) continue;
      // Phase 2: send on-chain, then finalize. A crash between these leaves the
      // claim in 'sending' → reported (above) next run, never auto-resent.
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
