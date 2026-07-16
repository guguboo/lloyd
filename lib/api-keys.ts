// lib/api-keys.ts — per-wallet API keys for the keyed MCP endpoint.
// Issuance is authenticated by an EIP-191 signature over a timestamped message
// (stateless ±5 min replay guard). The raw token exists only in the issuance
// response; the DB holds sha256(token).
import { createHash, randomBytes } from 'node:crypto';
import { verifyMessage } from 'viem';
import { supabaseAdmin as db } from './db';

const MAX_SKEW_MS = 5 * 60_000;

export function issuanceMessage(wallet: string, issuedAt: string): string {
  return `Lloyd API key issuance\nwallet: ${wallet.toLowerCase()}\nissued: ${issuedAt}`;
}

export async function verifyIssuance(a: {
  wallet: string; issuedAt: string; signature: string; now?: Date;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const t = Date.parse(a.issuedAt);
  if (!Number.isFinite(t)) return { ok: false, reason: 'bad_timestamp' };
  if (Math.abs((a.now ?? new Date()).getTime() - t) > MAX_SKEW_MS)
    return { ok: false, reason: 'stale_timestamp' };
  try {
    const ok = await verifyMessage({
      address: a.wallet as `0x${string}`,
      message: issuanceMessage(a.wallet, a.issuedAt),
      signature: a.signature as `0x${string}`,
    });
    return ok ? { ok: true } : { ok: false, reason: 'invalid_signature' };
  } catch {
    return { ok: false, reason: 'invalid_signature' };
  }
}

export const mintKey = (): string => `lloyd_sk_${randomBytes(32).toString('hex')}`;
export const hashKey = (token: string): string => createHash('sha256').update(token).digest('hex');

/** Gate-side lookup: presented bearer token → owning wallet, or null. */
export async function authenticateKey(token: string): Promise<{ wallet: string } | null> {
  if (!token.startsWith('lloyd_sk_')) return null;
  const { data, error } = await db.from('api_keys')
    .select('wallet').eq('key_hash', hashKey(token)).is('revoked_at', null).maybeSingle();
  if (error || !data) return null;
  // Best-effort usage stamp; never blocks auth (supabase builders run on .then).
  db.from('api_keys').update({ last_used_at: new Date().toISOString() })
    .eq('key_hash', hashKey(token)).then(() => {}, () => {});
  return { wallet: data.wallet.toLowerCase() };
}
