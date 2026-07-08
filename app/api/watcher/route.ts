import { timingSafeEqual } from 'node:crypto';
import { runSettlement } from '@/lib/settlement/run';
import { getJobMonitor, getTreasury } from '@/lib/okx';

export const maxDuration = 60;

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return new Response('server misconfigured', { status: 500 }); // fail closed
  const provided = req.headers.get('authorization') ?? '';
  const a = Buffer.from(provided);
  const b = Buffer.from(`Bearer ${expected}`);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return new Response('unauthorized', { status: 401 });
  const report = await runSettlement(getJobMonitor(), getTreasury());
  return Response.json(report);
}
