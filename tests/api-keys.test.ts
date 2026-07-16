import { describe, it, expect, vi } from 'vitest';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const maybeSingle = vi.fn();
vi.mock('@/lib/db', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({ eq: () => ({ is: () => ({ maybeSingle }) }) }),
      update: () => ({ eq: () => ({ then: (r: () => void) => r() }) }),
    }),
  },
}));

import { issuanceMessage, verifyIssuance, mintKey, hashKey, authenticateKey } from '@/lib/api-keys';

const acct = privateKeyToAccount(generatePrivateKey());
const other = privateKeyToAccount(generatePrivateKey());
const NOW = new Date('2026-07-16T12:00:00Z');
const ISSUED = '2026-07-16T11:58:00Z'; // 2 min old — inside the ±5 min window

const sign = (a: typeof acct, wallet: string, issuedAt: string) =>
  a.signMessage({ message: issuanceMessage(wallet, issuedAt) });

describe('key issuance signature', () => {
  it('the wallet holder can issue', async () => {
    const signature = await sign(acct, acct.address, ISSUED);
    expect(await verifyIssuance({ wallet: acct.address, issuedAt: ISSUED, signature, now: NOW }))
      .toEqual({ ok: true });
  });

  it("someone else's signature is rejected", async () => {
    const signature = await sign(other, acct.address, ISSUED);
    const v = await verifyIssuance({ wallet: acct.address, issuedAt: ISSUED, signature, now: NOW });
    expect(v.ok).toBe(false);
  });

  it('a stale timestamp is rejected (replay guard)', async () => {
    const stale = '2026-07-16T11:50:00Z'; // 10 min old
    const signature = await sign(acct, acct.address, stale);
    const v = await verifyIssuance({ wallet: acct.address, issuedAt: stale, signature, now: NOW });
    expect(v).toEqual({ ok: false, reason: 'stale_timestamp' });
  });

  it('a future timestamp beyond skew is rejected', async () => {
    const future = '2026-07-16T12:10:00Z';
    const signature = await sign(acct, acct.address, future);
    const v = await verifyIssuance({ wallet: acct.address, issuedAt: future, signature, now: NOW });
    expect(v).toEqual({ ok: false, reason: 'stale_timestamp' });
  });
});

describe('key material', () => {
  it('mintKey format and uniqueness', () => {
    const k = mintKey();
    expect(k).toMatch(/^lloyd_sk_[0-9a-f]{64}$/);
    expect(mintKey()).not.toBe(k);
  });

  it('hashKey is a stable sha256 hex', () => {
    expect(hashKey('lloyd_sk_abc')).toMatch(/^[0-9a-f]{64}$/);
    expect(hashKey('lloyd_sk_abc')).toBe(hashKey('lloyd_sk_abc'));
  });
});

describe('authenticateKey', () => {
  it('unknown/revoked hash → null; known → wallet (lowercased)', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(await authenticateKey('lloyd_sk_' + '0'.repeat(64))).toBeNull();
    maybeSingle.mockResolvedValueOnce({ data: { wallet: '0xABCDEF0000000000000000000000000000000001' }, error: null });
    expect(await authenticateKey('lloyd_sk_' + '0'.repeat(64)))
      .toEqual({ wallet: '0xabcdef0000000000000000000000000000000001' });
  });

  it('non-lloyd_sk tokens short-circuit to null (no DB hit)', async () => {
    maybeSingle.mockClear();
    expect(await authenticateKey('random-token')).toBeNull();
    expect(maybeSingle).not.toHaveBeenCalled();
  });
});
