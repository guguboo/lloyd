// Server-only: reads each settlement wallet's live balances straight from X Layer, so the
// Ledger's reserve is the real onchain USDT balance (the asset payouts are drawn from),
// not a book value. OKB is reported separately as the gas balance.
import { unstable_cache } from 'next/cache';
import { createPublicClient, defineChain, formatEther, formatUnits, erc20Abi } from 'viem';
import { rpcTransport, RPC_URLS } from './rpc';
import { TREASURY, type Network } from './chain';

const CHAINS: Record<Network, ReturnType<typeof defineChain>> = {
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

// The settlement asset per network (6 decimals). Testnet USD₮0 (funded); mainnet USDT0.
const USDT: Record<Network, `0x${string}`> = {
  testnet: (process.env.TESTNET_USDT_ADDRESS ?? '0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c') as `0x${string}`,
  mainnet: (process.env.MAINNET_USDT_ADDRESS ?? '0x779Ded0c9e1022225f8E0630b35a9b54bE713736') as `0x${string}`,
};
const USDT_DECIMALS = 6;

export type NetBalance = { usdt: number | null; okb: number | null };
export type Balances = Record<Network, NetBalance>;

async function balanceOf(net: Network): Promise<NetBalance> {
  try {
    const client = createPublicClient({ chain: CHAINS[net], transport: rpcTransport(RPC_URLS[net]) });
    const addr = TREASURY[net].address as `0x${string}`;
    const [usdtUnits, okbWei] = await Promise.all([
      client.readContract({ address: USDT[net], abi: erc20Abi, functionName: 'balanceOf', args: [addr] }),
      client.getBalance({ address: addr }),
    ]);
    return { usdt: Number(formatUnits(usdtUnits as bigint, USDT_DECIMALS)), okb: Number(formatEther(okbWei)) };
  } catch {
    return { usdt: null, okb: null }; // RPC unreachable — UI shows a dash and keeps the verify link
  }
}

// Cached 30s: keeps the external RPC round trips off every request's critical path.
export const getOnchainBalances = unstable_cache(
  async (): Promise<Balances> => {
    const [testnet, mainnet] = await Promise.all([balanceOf('testnet'), balanceOf('mainnet')]);
    return { testnet, mainnet };
  },
  ['onchain-balances-v2'],
  { revalidate: 30 },
);
