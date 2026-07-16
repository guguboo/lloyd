import { timingSafeEqual } from 'node:crypto';

// Constant-time bearer check for operator/cron endpoints (watcher, admin). Fails closed
// when the secret is unset. Shared so every privileged route authenticates identically.
export function bearerOk(req: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const provided = Buffer.from(req.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
