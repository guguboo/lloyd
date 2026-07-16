import { supabaseAdmin } from '@/lib/db';

// Liveness + DB reachability (M-5). Fast and unauthenticated so uptime monitors can poll it.
export async function GET() {
  let db: 'ok' | 'down' = 'down';
  try {
    const { error } = await supabaseAdmin.from('policies').select('id', { head: true, count: 'exact' });
    db = error ? 'down' : 'ok';
  } catch {
    db = 'down';
  }
  const ok = db === 'ok';
  return Response.json(
    { ok, db, mode: process.env.LLOYD_MODE ?? 'fixture' },
    { status: ok ? 200 : 503 },
  );
}
