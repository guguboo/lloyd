// lib/alert.ts — operator alerting. Fire-and-forget: alerting must NEVER break the
// money path, so every failure is swallowed (logged server-side only).
export async function sendAlert(text: string): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(5_000),
      // Discord reads `content`, Slack reads `text`; each ignores the other's field.
      body: JSON.stringify({ content: text, text }),
    });
  } catch (e) {
    console.error('[alert] webhook failed', e);
  }
}
