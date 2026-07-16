import { fallback, http } from 'viem';

// A settlement-grade transport must not die on one flaky RPC (M-4). Build a viem
// fallback over an ordered URL list (env override, comma-separated) so a down or
// rate-limiting primary rolls over to the next endpoint automatically.
export function rpcTransport(urls: string[]) {
  return fallback(urls.map((u) => http(u, { timeout: 8000, retryCount: 1 })));
}

// Ordered endpoints per network. First is primary; the rest are failover. Add verified
// failover endpoints via env (the public testnet `/terigon` node desyncs — "block out of
// range" — so it is intentionally excluded; add a known-good one through TESTNET_RPC_URLS).
export const RPC_URLS = {
  testnet: (process.env.TESTNET_RPC_URLS ?? 'https://testrpc.xlayer.tech')
    .split(',').map((s) => s.trim()).filter(Boolean),
  mainnet: (process.env.MAINNET_RPC_URLS ?? 'https://rpc.xlayer.tech,https://xlayerrpc.okx.com')
    .split(',').map((s) => s.trim()).filter(Boolean),
} as const;
