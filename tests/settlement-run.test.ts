import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PolicyRow, ClaimRow } from '@/lib/store';
import type { JobMonitor, JobState, Treasury } from '@/lib/okx/types';

// D7.4: the two-phase payout executor (lib/settlement/run.ts, pass 2) moves real
// USDT and had ZERO automated coverage. We mock the store module with vi.fn()s and
// pass in fake JobMonitor / Treasury objects (plain call recorders). No Supabase, no
// network — the real decideSettlement runs so the pass-1/pass-2 wiring is exercised.
vi.mock('@/lib/store', () => ({
  getActivePolicies: vi.fn(),
  getPendingClaims: vi.fn(),
  getStuckSendingClaims: vi.fn(),
  getPolicy: vi.fn(),
  openClaim: vi.fn(),
  markClaimSending: vi.fn(),
  markClaimPaid: vi.fn(),
  markPolicy: vi.fn(),
}));

import * as store from '@/lib/store';
import { runSettlement } from '@/lib/settlement/run';

// deadline in the future relative to `beforeDeadline`, past relative to `afterDeadline`
const deadline = '2026-07-14T12:00:00Z';
const beforeDeadline = new Date('2026-07-14T11:00:00Z');
const afterDeadline = new Date('2026-07-14T12:00:01Z');

function makePolicy(over: Partial<PolicyRow> = {}): PolicyRow {
  return {
    id: 'pol-1', quote_id: 'q-1', provider_id: 'prov-1', buyer_wallet: '0xBUYER',
    job_ref: 'job-1', job_value_usdt: 20, tier: 'frigate', coverage_usdt: 16,
    premium_usdt: 1.5, deadline_at: deadline, status: 'active',
    created_at: '2026-07-01T00:00:00Z',
    premium_tx: null, job_tx: null, delivered_at: null, delivery_sig: null, ...over,
  };
}
function makeClaim(over: Partial<ClaimRow> = {}): ClaimRow {
  return {
    id: 'clm-1', policy_id: 'pol-1', trigger: 'dispute_verdict',
    amount_usdt: 16, status: 'pending', tx_hash: null,
    created_at: '2026-07-01T00:00:00Z', ...over,
  };
}

// Fake JobMonitor: resolves each policy's job_ref to a fixed JobState via a lookup map.
function makeJobs(map: Record<string, JobState>): JobMonitor {
  return { getJobState: vi.fn(async (p: PolicyRow) => map[p.job_ref]) };
}
// Fake Treasury: records every sendUsdt call, returns a fixed tx hash by default.
function makeTreasury(txHash = '0xTX'): Treasury & { sendUsdt: ReturnType<typeof vi.fn> } {
  return { sendUsdt: vi.fn(async () => ({ txHash })) };
}

// vi.mocked shorthands for the store fakes
const m = {
  getActivePolicies: vi.mocked(store.getActivePolicies),
  getPendingClaims: vi.mocked(store.getPendingClaims),
  getStuckSendingClaims: vi.mocked(store.getStuckSendingClaims),
  getPolicy: vi.mocked(store.getPolicy),
  openClaim: vi.mocked(store.openClaim),
  markClaimSending: vi.mocked(store.markClaimSending),
  markClaimPaid: vi.mocked(store.markClaimPaid),
  markPolicy: vi.mocked(store.markPolicy),
};

beforeEach(() => {
  vi.clearAllMocks();
  // Sane empty defaults; each test overrides only what it drives.
  m.getActivePolicies.mockResolvedValue([]);
  m.getPendingClaims.mockResolvedValue([]);
  m.getStuckSendingClaims.mockResolvedValue([]);
  m.getPolicy.mockResolvedValue(null);
  m.openClaim.mockResolvedValue(null);
  m.markClaimSending.mockResolvedValue(true);
  m.markClaimPaid.mockResolvedValue(undefined);
  m.markPolicy.mockResolvedValue(undefined);
});

describe('runSettlement — pass-2 two-phase payout semantics (D7.4)', () => {
  it('1. happy path: provider_fault → open claim → send once → paid_out', async () => {
    const policy = makePolicy();
    const claim = makeClaim({ trigger: 'dispute_verdict' });
    m.getActivePolicies.mockResolvedValue([policy]);
    m.openClaim.mockResolvedValue(claim);
    m.getPendingClaims.mockResolvedValue([claim]);
    m.getPolicy.mockResolvedValue(policy);
    const jobs = makeJobs({ 'job-1': 'provider_fault' });
    const treasury = makeTreasury('0xDEAD');

    const report = await runSettlement(jobs, treasury, beforeDeadline);

    // Pass 1: dispute trigger, claim opened, policy → claim_pending
    expect(m.openClaim).toHaveBeenCalledWith('pol-1', 'dispute_verdict', 16);
    expect(m.markPolicy).toHaveBeenCalledWith('pol-1', 'claim_pending');
    // Pass 2: CAS, exactly one send with the right (wallet, amount, note), then finalize
    expect(m.markClaimSending).toHaveBeenCalledWith('clm-1');
    expect(treasury.sendUsdt).toHaveBeenCalledTimes(1);
    expect(treasury.sendUsdt).toHaveBeenCalledWith('0xBUYER', 16, 'Lloyd claim clm-1 on policy pol-1');
    expect(m.markClaimPaid).toHaveBeenCalledWith('clm-1', '0xDEAD');
    expect(m.markPolicy).toHaveBeenCalledWith('pol-1', 'paid_out');
    expect(report.paidOut).toEqual(['pol-1']);
    expect(report.checked).toBe(1);
    expect(report.errors).toEqual([]);
  });

  it('2. markClaimSending=false (already grabbed) → no send, not paid out', async () => {
    const policy = makePolicy();
    const claim = makeClaim();
    m.getPendingClaims.mockResolvedValue([claim]);
    m.getPolicy.mockResolvedValue(policy);
    m.markClaimSending.mockResolvedValue(false);
    const jobs = makeJobs({ 'job-1': 'provider_fault' });
    const treasury = makeTreasury();

    const report = await runSettlement(jobs, treasury, beforeDeadline);

    expect(m.markClaimSending).toHaveBeenCalledWith('clm-1');
    expect(treasury.sendUsdt).not.toHaveBeenCalled();
    expect(m.markClaimPaid).not.toHaveBeenCalled();
    expect(report.paidOut).toEqual([]);
    expect(report.errors).toEqual([]);
  });

  it('3. stuck sending claim is surfaced as an error, never auto-resent', async () => {
    m.getStuckSendingClaims.mockResolvedValue([makeClaim({ id: 'clm-stuck', policy_id: 'pol-9', status: 'sending' })]);
    const jobs = makeJobs({});
    const treasury = makeTreasury();

    const report = await runSettlement(jobs, treasury, beforeDeadline);

    expect(report.errors).toContainEqual({ policyId: 'pol-9', error: 'stuck_sending' });
    expect(treasury.sendUsdt).not.toHaveBeenCalled();
    expect(m.markClaimSending).not.toHaveBeenCalled();
  });

  it('4a. manual claim, job state not payable (delivered) → gate blocks: no CAS, no send', async () => {
    const policy = makePolicy();
    m.getPendingClaims.mockResolvedValue([makeClaim({ trigger: 'manual' })]);
    m.getPolicy.mockResolvedValue(policy);
    const jobs = makeJobs({ 'job-1': 'delivered' }); // decideSettlement → 'expire' (not payable)
    const treasury = makeTreasury();

    const report = await runSettlement(jobs, treasury, beforeDeadline);

    expect(m.markClaimSending).not.toHaveBeenCalled();
    expect(treasury.sendUsdt).not.toHaveBeenCalled();
    expect(report.paidOut).toEqual([]);
  });

  it('4b. manual claim, still pending before deadline → gate blocks (wait): no send', async () => {
    const policy = makePolicy();
    m.getPendingClaims.mockResolvedValue([makeClaim({ trigger: 'manual' })]);
    m.getPolicy.mockResolvedValue(policy);
    const jobs = makeJobs({ 'job-1': 'pending' }); // before deadline → 'wait'
    const treasury = makeTreasury();

    await runSettlement(jobs, treasury, beforeDeadline);

    expect(m.markClaimSending).not.toHaveBeenCalled();
    expect(treasury.sendUsdt).not.toHaveBeenCalled();
  });

  it('4c. manual claim, job state payable (provider_fault) → proceeds through CAS to send', async () => {
    const policy = makePolicy();
    m.getPendingClaims.mockResolvedValue([makeClaim({ trigger: 'manual' })]);
    m.getPolicy.mockResolvedValue(policy);
    const jobs = makeJobs({ 'job-1': 'provider_fault' }); // → 'payout_dispute'
    const treasury = makeTreasury('0xMANUAL');

    const report = await runSettlement(jobs, treasury, beforeDeadline);

    expect(m.markClaimSending).toHaveBeenCalledWith('clm-1');
    expect(treasury.sendUsdt).toHaveBeenCalledTimes(1);
    expect(m.markClaimPaid).toHaveBeenCalledWith('clm-1', '0xMANUAL');
    expect(report.paidOut).toEqual(['pol-1']);
  });

  it('4d. manual claim past deadline (payout_timeout) is also payable → sends', async () => {
    const policy = makePolicy();
    m.getPendingClaims.mockResolvedValue([makeClaim({ trigger: 'manual' })]);
    m.getPolicy.mockResolvedValue(policy);
    const jobs = makeJobs({ 'job-1': 'pending' }); // pending + past deadline → 'payout_timeout'
    const treasury = makeTreasury();

    const report = await runSettlement(jobs, treasury, afterDeadline);

    expect(treasury.sendUsdt).toHaveBeenCalledTimes(1);
    expect(report.paidOut).toEqual(['pol-1']);
  });

  it('5. delivered active policy expires in pass 1 → no claim, no send', async () => {
    const policy = makePolicy();
    m.getActivePolicies.mockResolvedValue([policy]);
    const jobs = makeJobs({ 'job-1': 'delivered' });
    const treasury = makeTreasury();

    const report = await runSettlement(jobs, treasury, beforeDeadline);

    expect(m.markPolicy).toHaveBeenCalledWith('pol-1', 'expired');
    expect(m.openClaim).not.toHaveBeenCalled();
    expect(treasury.sendUsdt).not.toHaveBeenCalled();
    expect(report.expired).toEqual(['pol-1']);
    expect(report.paidOut).toEqual([]);
    expect(report.checked).toBe(1);
  });

  it('6. openClaim returns null (pays-once: already claimed) → no crash, not re-marked', async () => {
    const policy = makePolicy();
    m.getActivePolicies.mockResolvedValue([policy]);
    m.openClaim.mockResolvedValue(null); // 23505 → already claimed
    const jobs = makeJobs({ 'job-1': 'provider_fault' });
    const treasury = makeTreasury();

    const report = await runSettlement(jobs, treasury, beforeDeadline);

    expect(m.openClaim).toHaveBeenCalledWith('pol-1', 'dispute_verdict', 16);
    // claim was null → policy status is NOT touched (no claim_pending, no double-process)
    expect(m.markPolicy).not.toHaveBeenCalled();
    expect(report.checked).toBe(1);
    expect(report.paidOut).toEqual([]);
    expect(report.errors).toEqual([]);
  });

  it('7. treasury.sendUsdt throws → caught per-claim, not paid, run continues to next claim', async () => {
    const p1 = makePolicy({ id: 'pol-1', job_ref: 'job-1', buyer_wallet: '0xA' });
    const p2 = makePolicy({ id: 'pol-2', job_ref: 'job-2', buyer_wallet: '0xB' });
    const c1 = makeClaim({ id: 'clm-1', policy_id: 'pol-1' });
    const c2 = makeClaim({ id: 'clm-2', policy_id: 'pol-2' });
    m.getPendingClaims.mockResolvedValue([c1, c2]);
    m.getPolicy.mockImplementation(async (id: string) => (id === 'pol-1' ? p1 : p2));
    const jobs = makeJobs({ 'job-1': 'provider_fault', 'job-2': 'provider_fault' });
    const treasury = makeTreasury('0xGOOD');
    treasury.sendUsdt.mockRejectedValueOnce(new Error('chain_down')); // first claim fails

    const report = await runSettlement(jobs, treasury, beforeDeadline);

    // First claim: error captured with its policyId, never marked paid
    expect(report.errors).toContainEqual({ policyId: 'pol-1', error: 'chain_down' });
    expect(m.markClaimPaid).not.toHaveBeenCalledWith('clm-1', expect.anything());
    // Run continued: second claim paid out normally
    expect(m.markClaimPaid).toHaveBeenCalledWith('clm-2', '0xGOOD');
    expect(report.paidOut).toEqual(['pol-2']);
    expect(treasury.sendUsdt).toHaveBeenCalledTimes(2);
  });

  it('8. report shape is correct across a mixed batch', async () => {
    const pExpire = makePolicy({ id: 'pol-exp', job_ref: 'job-exp' });
    const pClaim = makePolicy({ id: 'pol-clm', job_ref: 'job-clm' });
    const pWait = makePolicy({ id: 'pol-wait', job_ref: 'job-wait' });
    const payClaim = makeClaim({ id: 'clm-pay', policy_id: 'pol-pay' });
    const payPolicy = makePolicy({ id: 'pol-pay', job_ref: 'job-pay', buyer_wallet: '0xPAY' });

    m.getActivePolicies.mockResolvedValue([pExpire, pClaim, pWait]);
    m.openClaim.mockResolvedValue(makeClaim({ id: 'clm-new', policy_id: 'pol-clm' }));
    m.getStuckSendingClaims.mockResolvedValue([makeClaim({ id: 'clm-stuck', policy_id: 'pol-stuck', status: 'sending' })]);
    m.getPendingClaims.mockResolvedValue([payClaim]);
    m.getPolicy.mockResolvedValue(payPolicy);
    const jobs = makeJobs({
      'job-exp': 'delivered',        // → expire
      'job-clm': 'provider_fault',   // → open claim (claim_pending)
      'job-wait': 'pending',         // before deadline → wait
      'job-pay': 'provider_fault',   // pending claim → paid
    });
    const treasury = makeTreasury();

    const report = await runSettlement(jobs, treasury, beforeDeadline);

    expect(report.checked).toBe(3);                 // active policies only
    expect(report.expired).toEqual(['pol-exp']);
    expect(report.paidOut).toEqual(['pol-pay']);
    expect(report.errors).toEqual([{ policyId: 'pol-stuck', error: 'stuck_sending' }]);
  });

  it('9. preflight ok:false (short funds) → claim left pending, no CAS, no send', async () => {
    const policy = makePolicy();
    m.getPendingClaims.mockResolvedValue([makeClaim()]);
    m.getPolicy.mockResolvedValue(policy);
    const jobs = makeJobs({ 'job-1': 'provider_fault' });
    const treasury: Treasury & { sendUsdt: ReturnType<typeof vi.fn>; preflight: ReturnType<typeof vi.fn> } = {
      sendUsdt: vi.fn(async () => ({ txHash: '0xNO' })),
      preflight: vi.fn(async () => ({ ok: false, reason: 'insufficient_usdt' })),
    };

    const report = await runSettlement(jobs, treasury, beforeDeadline);

    expect(treasury.preflight).toHaveBeenCalledWith(16);
    // never moved to 'sending' → stays 'pending', retried next run once topped up
    expect(m.markClaimSending).not.toHaveBeenCalled();
    expect(treasury.sendUsdt).not.toHaveBeenCalled();
    expect(m.markClaimPaid).not.toHaveBeenCalled();
    expect(report.paidOut).toEqual([]);
    expect(report.errors).toContainEqual({ policyId: 'pol-1', error: 'preflight:insufficient_usdt' });
  });

  it('10. preflight ok:true → proceeds through the CAS to a normal payout', async () => {
    const policy = makePolicy();
    m.getPendingClaims.mockResolvedValue([makeClaim()]);
    m.getPolicy.mockResolvedValue(policy);
    const jobs = makeJobs({ 'job-1': 'provider_fault' });
    const treasury: Treasury & { sendUsdt: ReturnType<typeof vi.fn>; preflight: ReturnType<typeof vi.fn> } = {
      sendUsdt: vi.fn(async () => ({ txHash: '0xOK' })),
      preflight: vi.fn(async () => ({ ok: true })),
    };

    const report = await runSettlement(jobs, treasury, beforeDeadline);

    expect(treasury.preflight).toHaveBeenCalledWith(16);
    expect(m.markClaimSending).toHaveBeenCalledWith('clm-1');
    expect(treasury.sendUsdt).toHaveBeenCalledTimes(1);
    expect(m.markClaimPaid).toHaveBeenCalledWith('clm-1', '0xOK');
    expect(report.paidOut).toEqual(['pol-1']);
  });
});
