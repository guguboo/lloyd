import { describe, it, expect } from 'vitest';
import { validateEnv } from '@/lib/env';

const base: Record<string, string | undefined> = {
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  CRON_SECRET: 'cron',
};

describe('validateEnv (M-3 boot check)', () => {
  it('fixture mode: base vars are enough; mode defaults to fixture', () => {
    expect(validateEnv({ ...base }).LLOYD_MODE).toBe('fixture');
    expect(validateEnv({ ...base, LLOYD_MODE: 'fixture' }).LLOYD_MODE).toBe('fixture');
  });

  it('testnet mode requires the API key, then the signer key', () => {
    expect(() => validateEnv({ ...base, LLOYD_MODE: 'testnet' })).toThrow(/LLOYD_API_KEY/);
    expect(() => validateEnv({ ...base, LLOYD_MODE: 'testnet', LLOYD_API_KEY: 'k' })).toThrow(/TESTNET_PRIVATE_KEY/);
    expect(
      validateEnv({ ...base, LLOYD_MODE: 'testnet', LLOYD_API_KEY: 'k', TESTNET_PRIVATE_KEY: '0xabc' }).LLOYD_MODE,
    ).toBe('testnet');
  });

  it('real mode requires the API key', () => {
    expect(() => validateEnv({ ...base, LLOYD_MODE: 'real' })).toThrow(/LLOYD_API_KEY/);
  });

  it('a missing base var fails loudly', () => {
    expect(() => validateEnv({ LLOYD_MODE: 'fixture' })).toThrow(/Invalid environment/);
  });
});
