import { bearerOk } from '@/lib/http-auth';
import { runSettlement } from '@/lib/settlement/run';
import { getJobMonitor, getTreasury } from '@/lib/okx';

export const maxDuration = 60;

export async function GET(req: Request) {
  if (!bearerOk(req, process.env.CRON_SECRET)) return new Response('unauthorized', { status: 401 });
  const report = await runSettlement(getJobMonitor(), getTreasury());
  return Response.json(report);
}
