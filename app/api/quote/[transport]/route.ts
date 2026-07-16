// app/api/quote/[transport]/route.ts — Lloyd's FREE public surface, the URL registered
// on the OKX.AI marketplace (A2MCP, price 0). Quotes and policy reads are free; delivery
// attestation is self-authenticating by signature. No API key: nothing behind this
// endpoint can move funds. Rate-limited per IP.
import { createMcpHandler } from 'mcp-handler';
import { makeLimiter, clientIp } from '@/lib/rate-limit';
import { registerFreeTools } from '@/lib/mcp-tools';

const handler = createMcpHandler(
  (server) => registerFreeTools(server),
  undefined,
  { basePath: '/api/quote', disableSse: true }, // → /api/quote/mcp, /api/quote/sse, /api/quote/message
);

const overLimit = makeLimiter(60_000, 120);
function gate(h: (req: Request, ...rest: unknown[]) => Response | Promise<Response>) {
  return async (req: Request, ...rest: unknown[]): Promise<Response> => {
    if (overLimit(clientIp(req))) return Response.json({ error: 'rate_limited' }, { status: 429 });
    return h(req, ...rest);
  };
}

const gated = gate(handler as (req: Request, ...rest: unknown[]) => Promise<Response>);
export { gated as GET, gated as POST, gated as DELETE };
