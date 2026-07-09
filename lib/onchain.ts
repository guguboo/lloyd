// Server-only: reads each settlement wallet's live native (OKB) balance straight from
// X Layer, so the Ledger's reserve figure is the real onchain balance, not a book value.
import { unstable_cache } from 'next/cache';
import { createPublicClient, http, defineChain, formatEther } from 'viem';
import { TREASURY, type Network } from './chain';

const CHAINS: Record<Network, ReturnType<typeof defineChain>> = {
  testnet: defineChain({
    id: 1952,
    name: 'X Layer Testnet',
    nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
    rpcUrls: { default: { http: ['https://testrpc.xlayer.tech'] } },
  }),
  mainnet: defineChain({
    id: 196,
    name: 'X Layer',
    nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
    rpcUrls: { default: { http: ['https://rpc.xlayer.tech'] } },
  }),
};

export type Balances = Record<Network, number | null>;

async function balanceOf(net: Network): Promise<number | null> {
  try {
    const client = createPublicClient({
      chain: CHAINS[net],
      transport: http(undefined, { timeout: 4000, retryCount: 1 }),
    });
    const wei = await client.getBalance({ address: TREASURY[net].address as `0x${string}` });
    return Number(formatEther(wei));
  } catch {
    return null; // RPC unreachable — the UI shows a dash and keeps the verify link
  }
}

// Cached 30s: keeps two external RPC round trips off every request's critical path.
// ponytail: a failed read caches its null (a dash in the UI) for the same 30s — fine,
// and it stops us hammering a down RPC.
export const getOnchainBalances = unstable_cache(
  async (): Promise<Balances> => {
    const [testnet, mainnet] = await Promise.all([balanceOf('testnet'), balanceOf('mainnet')]);
    return { testnet, mainnet };
  },
  ['onchain-balances'],
  { revalidate: 30 },
);
