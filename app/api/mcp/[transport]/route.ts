// app/api/mcp/[transport]/route.ts
import { createMcpHandler } from 'mcp-handler';
import { timingSafeEqual } from 'node:crypto';
import { makeLimiter, clientIp } from '@/lib/rate-limit';
import { registerFreeTools, registerPaidTools } from '@/lib/mcp-tools';
import { authenticateKey } from '@/lib/api-keys';
import { authStore, type AuthCtx } from '@/lib/auth-context';

const handler = createMcpHandler(
  (server) => {
    registerFreeTools(server);
    registerPaidTools(server);
  },
  undefined,
  // mcp-handler matches url.pathname === endpoint EXACTLY (verified in dist/index.js:279), so
  // basePath derives '/api/mcp/mcp' (streamable HTTP), '/api/mcp/sse', '/api/mcp/message'.
  {
    basePath: '/api/mcp',
    // SSE executes tools in a Redis-subscription callback OUTSIDE the request's
    // AsyncLocalStorage context — wallet enforcement would silently vanish. Streamable
    // HTTP only, on both endpoints, until auth is carried per-message.
    disableSse: true,
  },
);

// ── Endpoint gate (C-5 / H-5) ──────────────────────────────────────────────
// Money can move whenever LLOYD_MODE ≠ fixture, so in those modes this endpoint requires
// a bearer key (master or per-wallet); fixture stays open. Rate limit applies in every mode.
const MODE = process.env.LLOYD_MODE ?? 'fixture';
const API_KEY = process.env.LLOYD_API_KEY;
const overLimit = makeLimiter(60_000, 120);
function keyEq(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
function gate(h: (req: Request, ...rest: unknown[]) => Response | Promise<Response>) {
  return async (req: Request, ...rest: unknown[]): Promise<Response> => {
    if (overLimit(clientIp(req))) return Response.json({ error: 'rate_limited' }, { status: 429 });
    let ctx: AuthCtx = { wallet: null, master: true }; // fixture mode: open, unrestricted
    if (MODE !== 'fixture') {
      if (!API_KEY) return Response.json({ error: 'server_auth_misconfigured' }, { status: 503 });
      const hdr = req.headers.get('authorization') ?? '';
      const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : '';
      if (keyEq(token, API_KEY)) {
        ctx = { wallet: null, master: true };
      } else {
        const viaKey = await authenticateKey(token);
        if (!viaKey) return Response.json({ error: 'unauthorized' }, { status: 401 });
        ctx = { wallet: viaKey.wallet, master: false };
      }
    }
    return authStore.run(ctx, () => h(req, ...rest));
  };
}

const gated = gate(handler as (req: Request, ...rest: unknown[]) => Promise<Response>);
export { gated as GET, gated as POST, gated as DELETE };
