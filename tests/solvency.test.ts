// tests/solvency.test.ts
import { describe, it, expect } from 'vitest';
import { canBind, type BindContext } from '@/lib/treasury/solvency';

const base: BindContext = {
  poolUsdt: 300, outstandingUsdt: 100, providerOutstandingUsdt: 10,
  newCoverageUsdt: 16, buyerPaidClaims7d: 0,
  buyerHasActivePolicyWithProvider: false, killSwitch: false,
};

describe('canBind', () => {
  it('accepts a healthy bind', () => expect(canBind(base)).toEqual({ ok: true }));
  it('refuses when kill switch is on', () =>
    expect(canBind({ ...base, killSwitch: true })).toEqual({ ok: false, reason: 'kill_switch_active' }));
  it('refuses a second active policy for the same pair', () =>
    expect(canBind({ ...base, buyerHasActivePolicyWithProvider: true }))
      .toEqual({ ok: false, reason: 'active_policy_exists_for_pair' }));
  it('refuses at 2 paid claims in 7 days', () =>
    expect(canBind({ ...base, buyerPaidClaims7d: 2 })).toEqual({ ok: false, reason: 'claim_velocity_limit' }));
  it('refuses when pool utilization would exceed 50% (135+16 > 150)', () =>
    expect(canBind({ ...base, outstandingUsdt: 135 })).toEqual({ ok: false, reason: 'pool_utilization_cap' }));
  it('refuses when provider share would exceed 10% (20+16 > 30)', () =>
    expect(canBind({ ...base, providerOutstandingUsdt: 20 })).toEqual({ ok: false, reason: 'provider_exposure_cap' }));
  it('boundary: exactly 50% utilization is allowed (134+16 = 150)', () =>
    expect(canBind({ ...base, outstandingUsdt: 134 })).toEqual({ ok: true }));
});
