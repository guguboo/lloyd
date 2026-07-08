import { describe, it, expect } from 'vitest';
import { decideSettlement } from '@/lib/settlement/decide';

const deadline = new Date('2026-07-14T12:00:00Z');
const before = new Date('2026-07-14T11:00:00Z');
const after = new Date('2026-07-14T12:00:01Z');

describe('decideSettlement', () => {
  it('dispute verdict beats everything, even before deadline', () =>
    expect(decideSettlement('provider_fault', deadline, before)).toBe('payout_dispute'));
  it('delivered → expire (coverage ends, no payout)', () =>
    expect(decideSettlement('delivered', deadline, before)).toBe('expire'));
  it('pending past deadline → payout_timeout', () =>
    expect(decideSettlement('pending', deadline, after)).toBe('payout_timeout'));
  it('pending before deadline → wait', () =>
    expect(decideSettlement('pending', deadline, before)).toBe('wait'));
  it('delivered past deadline still expires without payout', () =>
    expect(decideSettlement('delivered', deadline, after)).toBe('expire'));
});
