import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendAlert } from '@/lib/alert';

describe('sendAlert', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('no-op without ALERT_WEBHOOK_URL', async () => {
    vi.stubEnv('ALERT_WEBHOOK_URL', '');
    await sendAlert('boom');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs a Discord/Slack-compatible payload', async () => {
    vi.stubEnv('ALERT_WEBHOOK_URL', 'https://hooks.example/x');
    fetchMock.mockResolvedValue({ ok: true });
    await sendAlert('3 errors');
    expect(fetchMock).toHaveBeenCalledWith('https://hooks.example/x', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ content: '3 errors', text: '3 errors' }),
    }));
  });

  it('never throws — webhook failure is swallowed', async () => {
    vi.stubEnv('ALERT_WEBHOOK_URL', 'https://hooks.example/x');
    fetchMock.mockRejectedValue(new Error('down'));
    await expect(sendAlert('x')).resolves.toBeUndefined();
  });
});
