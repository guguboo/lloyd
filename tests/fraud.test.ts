import { describe, it, expect } from 'vitest';
import { assessFraud, type FraudContext } from '@/lib/fraud';

const BUYER = '0x1111111111111111111111111111111111111111';
const PROVIDER = '0x2222222222222222222222222222222222222222';

const ctx = (over: Partial<FraudContext> = {}): FraudContext => ({
  buyerWallet: BUYER,
  providerWallet: PROVIDER,
  linkedToBuyer: false,
  requireOnchainProof: true,
  pairPaidClaims: 0,
  buyerPolicies: 0,
  buyerPaidClaims: 0,
  ...over,
});

const reason = (c: FraudContext) => {
  const v = assessFraud(c);
  return v.ok ? null : v.reason;
};

describe('assessFraud — bind-time controls', () => {
  it('a clean buyer/provider pair binds', () => {
    expect(assessFraud(ctx())).toEqual({ ok: true });
  });

  it('self-dealing: buyer IS the provider (any casing) → blocked', () => {
    expect(reason(ctx({ providerWallet: BUYER }))).toBe('self_dealing_same_wallet');
    expect(reason(ctx({ providerWallet: BUYER.toUpperCase().replace('0X', '0x') })))
      .toBe('self_dealing_same_wallet');
  });

  it('known linked wallets → blocked', () => {
    expect(reason(ctx({ linkedToBuyer: true }))).toBe('linked_wallets');
  });

  it('a pair that already produced a payout never binds again', () => {
    expect(reason(ctx({ pairPaidClaims: 1 }))).toBe('pair_prior_loss');
  });

  it('a buyer whose policies keep converting to payouts → blocked', () => {
    expect(reason(ctx({ buyerPolicies: 4, buyerPaidClaims: 3 }))).toBe('abnormal_claim_rate');
    // ...but a normal loss record is fine, and one bad policy out of few proves nothing
    expect(assessFraud(ctx({ buyerPolicies: 4, buyerPaidClaims: 2 }))).toEqual({ ok: true });
    expect(assessFraud(ctx({ buyerPolicies: 2, buyerPaidClaims: 2 }))).toEqual({ ok: true });
  });

  it('no provider wallet → uninsurable when proof is required, allowed in fixture mode', () => {
    expect(reason(ctx({ providerWallet: null }))).toBe('provider_wallet_unknown');
    expect(assessFraud(ctx({ providerWallet: null, requireOnchainProof: false }))).toEqual({ ok: true });
  });
});
