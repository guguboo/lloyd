import { bearerOk } from '@/lib/http-auth';
import { resolveStuckClaim } from '@/lib/store';

// Operator recovery for a claim wedged in 'sending' (H-2). The two-phase send never
// auto-retries a 'sending' claim (its on-chain outcome is unknown), so an operator resolves
// it here after checking the chain:
//   { claimId, action: 'paid', txHash }  → finalize with the confirmed on-chain tx
//   { claimId, action: 'reset' }         → nothing was sent; return it to the retry queue
// Bearer CRON_SECRET, same as the watcher.
export async function POST(req: Request) {
  if (!bearerOk(req, process.env.CRON_SECRET)) return new Response('unauthorized', { status: 401 });

  let body: { claimId?: string; action?: 'paid' | 'reset'; txHash?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  const { claimId, action, txHash } = body;
  if (!claimId || (action !== 'paid' && action !== 'reset')) {
    return Response.json({ ok: false, error: 'claimId and action(paid|reset) required' }, { status: 400 });
  }
  if (action === 'paid' && !txHash) {
    return Response.json({ ok: false, error: 'txHash required to resolve as paid' }, { status: 400 });
  }

  try {
    const result = await resolveStuckClaim(claimId, action, txHash);
    if (!result.ok) return Response.json({ ok: false, error: 'claim_not_stuck_or_not_found' }, { status: 409 });
    return Response.json({ ok: true, claimId, action, policyId: result.policyId });
  } catch (e) {
    console.error('[admin] resolve_claim_error', e);
    return Response.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}
