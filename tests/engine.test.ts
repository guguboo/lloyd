import { describe, it, expect } from 'vitest';
import { evaluateQuote, coverageForTier, round2 } from '@/lib/underwrite/engine';
import type { ProviderRecord } from '@/lib/underwrite/types';

const veteran: ProviderRecord = {
  providerId: 'agent-vet', walletAgeDays: 120, completedJobs: 80,
  totalVolumeUsdt: 5000, disputeRate: 0.01, avgRating: 4.8, linkedToBuyer: false,
};

const solid: ProviderRecord = { ...veteran, completedJobs: 20, disputeRate: 0.05 }; // class B
const marlowe: ProviderRecord = {
  providerId: 'marlowe', walletAgeDays: 40, completedJobs: 12,
  totalVolumeUsdt: 300, disputeRate: 0.05, avgRating: 4.0, linkedToBuyer: false,
}; // class B — the demo case

describe('evaluateQuote — tiered quotes (D1 golden numbers)', () => {
  it('demo golden: class B, $20 job → {skiff 10.71, frigate 16, galleon 16}, recommends frigate', () => {
    expect(evaluateQuote(marlowe, 20)).toEqual({
      decision: 'quote', riskClass: 'B', newcomer: false,
      tiers: { skiff: 10.71, frigate: 16, galleon: 16 },
      recommendedTier: 'frigate',
    });
  });

  it('class-A veteran, $20 job: skiff already reaches max coverage 16 → recommends skiff', () => {
    expect(evaluateQuote(veteran, 20)).toEqual({
      decision: 'quote', riskClass: 'A', newcomer: false,
      tiers: { skiff: 16, frigate: 16, galleon: 16 },
      recommendedTier: 'skiff',
    });
  });

  it('newcomer, $40 job: forced class C, $10 cap → {skiff 5, frigate 10, galleon 10}, recommends frigate', () => {
    const newbie: ProviderRecord = { ...veteran, completedJobs: 1, walletAgeDays: 2 };
    expect(evaluateQuote(newbie, 40)).toEqual({
      decision: 'quote', riskClass: 'C', newcomer: true,
      tiers: { skiff: 5, frigate: 10, galleon: 10 },
      recommendedTier: 'frigate',
    });
  });

  it('class A, $100 job: global $50 cap binds → {skiff 25, frigate 50, galleon 50}, recommends frigate', () => {
    expect(evaluateQuote(veteran, 100)).toEqual({
      decision: 'quote', riskClass: 'A', newcomer: false,
      tiers: { skiff: 25, frigate: 50, galleon: 50 },
      recommendedTier: 'frigate',
    });
  });

  it('tie-break: when every tier ties on coverage, the cheapest wins (class B, $6 job → all 4.8 → skiff)', () => {
    expect(evaluateQuote(solid, 6)).toEqual({
      decision: 'quote', riskClass: 'B', newcomer: false,
      tiers: { skiff: 4.8, frigate: 4.8, galleon: 4.8 },
      recommendedTier: 'skiff',
    });
  });
});

describe('risk class downgrades', () => {
  it('downgrades one class when dispute rate > 0.10 (A → B)', () => {
    expect(evaluateQuote({ ...veteran, disputeRate: 0.12 }, 20)).toMatchObject({ riskClass: 'B' });
  });

  it('downgrades one class when avgRating < 3.5 (B → C)', () => {
    expect(evaluateQuote({ ...solid, avgRating: 3.0 }, 20)).toMatchObject({ riskClass: 'C' });
  });
});

describe('declines', () => {
  it('declines linked wallets', () => {
    expect(evaluateQuote({ ...veteran, linkedToBuyer: true }, 20))
      .toEqual({ decision: 'decline', reason: 'linked_wallets' });
  });

  it('declines dispute rate > 0.25', () => {
    expect(evaluateQuote({ ...solid, disputeRate: 0.3 }, 20))
      .toEqual({ decision: 'decline', reason: 'high_dispute_rate' });
  });

  it('declines non-positive job values', () => {
    expect(evaluateQuote(veteran, 0)).toEqual({ decision: 'decline', reason: 'invalid_job_value' });
    expect(evaluateQuote(veteran, -5)).toEqual({ decision: 'decline', reason: 'invalid_job_value' });
  });

  it('declines unusable data: NaN dispute rate', () => {
    expect(evaluateQuote({ ...veteran, disputeRate: NaN }, 20))
      .toEqual({ decision: 'decline', reason: 'data_unavailable' });
  });

  it('declines unusable data: dispute rate outside 0..1', () => {
    expect(evaluateQuote({ ...veteran, disputeRate: 1.2 }, 20))
      .toEqual({ decision: 'decline', reason: 'data_unavailable' });
  });
});

describe('coverageForTier — class boundaries', () => {
  it('class A: skiff buys 0.75 / 0.03 = 25 when no cap binds', () => {
    expect(coverageForTier('skiff', 'A', 100, false)).toBe(25);
  });

  it('class B: skiff buys 0.75 / 0.07 → 10.71 after round2', () => {
    expect(coverageForTier('skiff', 'B', 1000, false)).toBe(10.71);
  });

  it('class C: galleon buys 3.5 / 0.15 → 23.33 after round2', () => {
    expect(coverageForTier('galleon', 'C', 1000, false)).toBe(23.33);
  });

  it('global $50 cap binds: galleon / class A on a big job', () => {
    expect(coverageForTier('galleon', 'A', 1000, false)).toBe(50);
  });

  it('newcomer $10 cap binds regardless of tier', () => {
    expect(coverageForTier('galleon', 'C', 1000, true)).toBe(10);
  });

  it('80% co-insurance binds on small jobs: galleon / class A, $20 job → 16', () => {
    expect(coverageForTier('galleon', 'A', 20, false)).toBe(16);
  });
});

describe('round2', () => {
  it('rounds to 2 decimals', () => {
    expect(round2(10.714285)).toBe(10.71);
    expect(round2(23.333333)).toBe(23.33);
    expect(round2(0.125)).toBe(0.13); // exact binary half rounds up
    expect(round2(16)).toBe(16);
  });
});
