// Shared X Layer chain + settlement-asset config for read-only verification.
// (The signing treasury keeps its own client in lib/okx/real.ts — server-only, holds the key.)
import { createPublicClient, defineChain } from 'viem';
import { rpcTransport, RPC_URLS } from './rpc';
import type { Network } from './chain';

export const CHAINS: Record<Network, ReturnType<typeof defineChain>> = {
  testnet: defineChain({
    id: 1952,
    name: 'X Layer Testnet',
    nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
    rpcUrls: { default: { http: RPC_URLS.testnet } },
  }),
  mainnet: defineChain({
    id: 196,
    name: 'X Layer',
    nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
    rpcUrls: { default: { http: RPC_URLS.mainnet } },
  }),
};

// The settlement asset per network (both 6 decimals). Testnet USD₮0; mainnet USDT0.
export const USDT: Record<Network, `0x${string}`> = {
  testnet: (process.env.TESTNET_USDT_ADDRESS ?? '0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c') as `0x${string}`,
  mainnet: (process.env.MAINNET_USDT_ADDRESS ?? '0x779Ded0c9e1022225f8E0630b35a9b54bE713736') as `0x${string}`,
};
export const USDT_DECIMALS = 6;

export const publicClient = (net: Network) =>
  createPublicClient({ chain: CHAINS[net], transport: rpcTransport(RPC_URLS[net]) });

/** The network money actually moves on in the current mode. */
export const activeNetwork = (): Network => (process.env.LLOYD_MODE === 'real' ? 'mainnet' : 'testnet');

/** Off fixture, real value moves — so premium + job payment must be proven onchain. */
export const proofRequired = (): boolean => (process.env.LLOYD_MODE ?? 'fixture') !== 'fixture';
