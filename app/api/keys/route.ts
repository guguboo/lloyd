// app/api/keys/route.ts — self-serve per-wallet API key issuance.
// Auth = an EIP-191 signature over a timestamped message from the wallet itself.
import { isAddress } from 'viem';
import { z } from 'zod';
import { verifyIssuance, mintKey, hashKey } from '@/lib/api-keys';
import { makeLimiter, clientIp } from '@/lib/rate-limit';
import { supabaseAdmin as db } from '@/lib/db';

const Body = z.object({
  wallet: z.string().max(60),
  signature: z.string().min(1).max(500),
  issued_at: z.string().max(40),
  label: z.string().max(80).optional(),
});

const overLimit = makeLimiter(3_600_000, 10);

export async function POST(req: Request) {
  if (overLimit(clientIp(req))) return Response.json({ ok: false, error: 'rate_limited' }, { status: 429 });

  let body;
  try {
    body = Body.parse(await req.json());
  } catch {
    return Response.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }
  const wallet = body.wallet.toLowerCase();
  if (!isAddress(wallet)) return Response.json({ ok: false, error: 'invalid_wallet' }, { status: 400 });

  const v = await verifyIssuance({ wallet, issuedAt: body.issued_at, signature: body.signature });
  if (!v.ok) return Response.json({ ok: false, error: v.reason }, { status: 401 });

  try {
    const key = mintKey();
    const { error } = await db.from('api_keys')
      .insert({ wallet, key_hash: hashKey(key), label: body.label ?? null });
    if (error) throw error;
    // The one and only time the raw key exists outside the caller's hands.
    return Response.json({ ok: true, api_key: key, wallet });
  } catch (e) {
    console.error('[api/keys]', e);
    return Response.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}
