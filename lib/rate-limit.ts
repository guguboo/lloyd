// ponytail: per-instance in-memory limiter — resets on cold start, not shared across
// serverless instances. Enough to blunt one abuser; swap for a shared KV bucket if it matters.
export function makeLimiter(windowMs: number, maxReq: number): (key: string) => boolean {
  const hits = new Map<string, { n: number; reset: number }>();
  return function overLimit(key: string): boolean {
    const now = Date.now();
    const e = hits.get(key);
    if (!e || now > e.reset) { hits.set(key, { n: 1, reset: now + windowMs }); return false; }
    return ++e.n > maxReq;
  };
}

/** The client key: first hop of x-forwarded-for (set by the platform), or 'unknown'. */
export const clientIp = (req: Request) =>
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
