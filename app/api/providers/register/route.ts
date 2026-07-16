// Provider self-registration — the ASP entry point.
//
// Any ASP operator can list themselves as insurable by proving they control a payout
// wallet: sign the registration message with it (EIP-191, gasless). No curation step —
// the underwriting engine contains the risk instead: a fresh dossier has zero history,
// so evaluateQuote classes it newcomer/C and coverage is capped at $10 until a real
// track record accrues. Registration can create exposure of at most pocket change.
import { isAddress } from 'viem';
import { z } from 'zod';
import { verifyRegistration } from '@/lib/attestation';
import { supabaseAdmin as db } from '@/lib/db';
import { makeLimiter, clientIp } from '@/lib/rate-limit';

const Body = z.object({
  // Slug-ish ids only: these appear in quotes, policies, and the public ledger.
  provider_id: z.string().min(3).max(60).regex(/^[a-z0-9][a-z0-9._:-]*$/),
  wallet: z.string().max(60),
  signature: z.string().min(1).max(500),
});

// Registration is cheap (one sig verify + one insert) but the table is forever;
// blunt drive-by spam per instance. Same ponytail limiter as the MCP gate.
const overLimit = makeLimiter(3_600_000, 10);

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (overLimit(ip)) return Response.json({ ok: false, error: 'rate_limited' }, { status: 429 });

  let body;
  try {
    body = Body.parse(await req.json());
  } catch {
    return Response.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }
  const { provider_id, signature } = body;
  const wallet = body.wallet.toLowerCase();
  if (!isAddress(wallet)) return Response.json({ ok: false, error: 'invalid_wallet' }, { status: 400 });

  // The signature IS the authentication: only the key holder can list this wallet.
  if (!(await verifyRegistration({ providerId: provider_id, wallet, signature })))
    return Response.json({ ok: false, error: 'invalid_signature' }, { status: 401 });

  try {
    // One wallet, one provider identity — otherwise a claim-farmer could rotate fresh
    // provider ids over the same wallet to reset the per-pair fraud gate.
    const { data: taken, error: takenErr } = await db.from('provider_dossiers')
      .select('provider_id').eq('wallet', wallet).maybeSingle();
    if (takenErr) throw takenErr;
    if (taken && taken.provider_id !== provider_id)
      return Response.json({ ok: false, error: 'wallet_already_registered' }, { status: 409 });

    const { data: existing, error: existErr } = await db.from('provider_dossiers')
      .select('wallet').eq('provider_id', provider_id).maybeSingle();
    if (existErr) throw existErr;
    if (existing) {
      // Same id + same proven wallet → idempotent re-register; different wallet → taken.
      if (existing.wallet === wallet) return Response.json({ ok: true, provider_id, wallet, status: 'already_registered' });
      return Response.json({ ok: false, error: 'provider_id_taken' }, { status: 409 });
    }

    // Zero history on purpose: the newcomer path of the underwriting engine is the gate.
    const { error: insertErr } = await db.from('provider_dossiers').insert({
      provider_id, wallet,
      wallet_age_days: 0, completed_jobs: 0, total_volume_usdt: 0,
      dispute_rate: 0, avg_rating: null, linked_wallets: [],
    });
    if (insertErr) {
      if (insertErr.code === '23505') return Response.json({ ok: false, error: 'provider_id_taken' }, { status: 409 });
      throw insertErr;
    }
    return Response.json({
      ok: true, provider_id, wallet, status: 'registered',
      terms: 'Newcomer terms: risk class C, coverage capped at $10 per policy until a delivery record accrues.',
    });
  } catch (e) {
    console.error('[providers/register]', e);
    return Response.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}
