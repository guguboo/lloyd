// tests/auth-context.test.ts
import { describe, it, expect } from 'vitest';
import { authStore, authWallet, hasAuthContext, walletMismatch } from '@/lib/auth-context';

const W = '0xabcdef0000000000000000000000000000000001';

describe('auth context', () => {
  it('outside any context: no wallet, never a mismatch (master/free/fixture)', () => {
    expect(authWallet()).toBeNull();
    expect(walletMismatch(W)).toBe(false);
  });

  it('master context: never a mismatch', () => {
    authStore.run({ wallet: null, master: true }, () => {
      expect(walletMismatch(W)).toBe(false);
    });
  });

  it('wallet context: own wallet ok (any casing), other wallet mismatch', () => {
    authStore.run({ wallet: W, master: false }, () => {
      expect(walletMismatch(W)).toBe(false);
      expect(walletMismatch(W.toUpperCase().replace('0X', '0x'))).toBe(false);
      expect(walletMismatch('0x1111111111111111111111111111111111111111')).toBe(true);
    });
  });

  it('hasAuthContext: false outside any gate, true inside (master or wallet)', () => {
    expect(hasAuthContext()).toBe(false);
    authStore.run({ wallet: null, master: true }, () => expect(hasAuthContext()).toBe(true));
    authStore.run({ wallet: W, master: false }, () => expect(hasAuthContext()).toBe(true));
  });
});
