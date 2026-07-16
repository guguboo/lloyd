import { bearerOk } from '@/lib/http-auth';
import { runSettlement } from '@/lib/settlement/run';
import { getJobMonitor, getTreasury } from '@/lib/okx';
import { sendAlert } from '@/lib/alert';

export const maxDuration = 60;

export async function GET(req: Request) {
  if (!bearerOk(req, process.env.CRON_SECRET)) return new Response('unauthorized', { status: 401 });
  const report = await runSettlement(getJobMonitor(), getTreasury());
  if (report.errors.length > 0) {
    const lines = report.errors.slice(0, 5).map((e) => `• ${e.policyId}: ${e.error}`).join('\n');
    await sendAlert(`Lloyd watcher: ${report.errors.length} error(s)\n${lines}`);
  }
  return Response.json(report);
}
