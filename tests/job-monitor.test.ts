import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PolicyRow } from '@/lib/store';

// jobMonitor.getJobState decides whether a policy can pay out. Two sources, one per flow:
//   real policy (job_tx set) -> the provider's signed delivery attestation IS the oracle
//   demo policy              -> demo_jobs, failing CLOSED on an unknown job_ref (C-4)
const maybeSingle = vi.fn();
vi.mock('@/lib/db', () => ({
  supabaseAdmin: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) },
}));

import { jobMonitor } from '@/lib/okx/fixtures';

const policy = (over: Partial<PolicyRow> = {}): PolicyRow => ({
  id: 'pol-1', quote_id: 'q-1', provider_id: 'prov-1', buyer_wallet: '0xBUYER',
  job_ref: 'job-1', job_value_usdt: 20, tier: 'frigate', coverage_usdt: 16, premium_usdt: 1.5,
  deadline_at: '2026-07-14T12:00:00Z', status: 'active', created_at: '2026-07-01T00:00:00Z',
  premium_tx: null, job_tx: null, delivered_at: null, delivery_sig: null, ...over,
});

describe('jobMonitor.getJobState — real policies (attestation oracle)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('no attestation → "pending" (so it pays out once the deadline passes)', async () => {
    expect(await jobMonitor.getJobState(policy({ job_tx: '0xabc' }))).toBe('pending');
    expect(maybeSingle).not.toHaveBeenCalled(); // never falls back to demo_jobs
  });

  it('provider attested → "delivered" (lapses, no claim)', async () => {
    const p = policy({ job_tx: '0xabc', delivered_at: '2026-07-13T10:00:00Z' });
    expect(await jobMonitor.getJobState(p)).toBe('delivered');
  });
});

describe('jobMonitor.getJobState — demo policies, fail closed (C-4)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('unknown job_ref (no row) → "delivered" (non-payable, expires)', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await jobMonitor.getJobState(policy({ job_ref: 'phantom-ref' }))).toBe('delivered');
  });

  it('known job_ref returns its actual stored state', async () => {
    maybeSingle.mockResolvedValueOnce({ data: { state: 'pending' }, error: null });
    expect(await jobMonitor.getJobState(policy())).toBe('pending');
    maybeSingle.mockResolvedValueOnce({ data: { state: 'provider_fault' }, error: null });
    expect(await jobMonitor.getJobState(policy())).toBe('provider_fault');
  });

  it('DB error propagates (never silently defaults to payable)', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: new Error('db_down') });
    await expect(jobMonitor.getJobState(policy())).rejects.toThrow('db_down');
  });
});
