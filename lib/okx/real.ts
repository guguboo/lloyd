// lib/okx/real.ts — real settlement on X Layer testnet. Every payout is an actual
// ERC-20 USDT (USD₮0) transfer of the claim's coverage amount from Lloyd's treasury to
// the buyer, returning the real tx hash the Ledger surfaces. USDT is the settlement
// asset; the treasury pays gas in native OKB.
// Server-only: reads TESTNET_PRIVATE_KEY. Never import this from client code.
import {
  createWalletClient,
  createPublicClient,
  defineChain,
  parseUnits,
  parseEther,
  formatUnits,
  isAddress,
  erc20Abi,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { rpcTransport, RPC_URLS } from '../rpc';
import type { Treasury } from './types';

const xLayerTestnet = defineChain({
  id: 1952,
  name: 'X Layer Testnet',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: { default: { http: ['https://testrpc.xlayer.tech'] } },
});

// USD₮0 on X Layer testnet — the settlement asset. 6 decimals (confirmed on-chain).
// Override per-network via env when the address differs.
const USDT_ADDRESS = (process.env.TESTNET_USDT_ADDRESS ??
  '0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c') as `0x${string}`;
const USDT_DECIMALS = 6;
// Keep a little OKB in reserve so we never broadcast a transfer that can't pay gas.
const MIN_GAS_WEI = parseEther(process.env.TESTNET_MIN_GAS_OKB ?? '0.002');

// USDT is fixed-point (6 dp). Format the dollar amount to exactly that precision before
// scaling to base units — never parseEther, never let a float widen past 6 dp.
const toBaseUnits = (amountUsdt: number) => parseUnits(amountUsdt.toFixed(USDT_DECIMALS), USDT_DECIMALS);

// Built lazily so a missing key only errors when a real payout is actually attempted,
// never at import time. The inferred ReturnType keeps the account/chain bound so the
// contract write typechecks.
function makeClients() {
  const pk = process.env.TESTNET_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk) throw new Error('TESTNET_PRIVATE_KEY must be set for testnet settlement');
  const account = privateKeyToAccount(pk);
  return {
    account,
    wallet: createWalletClient({ account, chain: xLayerTestnet, transport: rpcTransport(RPC_URLS.testnet) }),
    pub: createPublicClient({ chain: xLayerTestnet, transport: rpcTransport(RPC_URLS.testnet) }),
  };
}
let cached: ReturnType<typeof makeClients> | null = null;

export const testnetTreasury: Treasury = {
  // Checked before the pays-once CAS: if the treasury can't cover this payout (USDT) or
  // its gas (OKB), report and leave the claim 'pending' to retry — never wedge it.
  async preflight(amountUsdt) {
    try {
      const { account, pub } = (cached ??= makeClients());
      const [usdt, gas] = await Promise.all([
        pub.readContract({ address: USDT_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] }),
        pub.getBalance({ address: account.address }),
      ]);
      if (usdt < toBaseUnits(amountUsdt))
        return { ok: false, reason: `insufficient_usdt (have ${formatUnits(usdt, USDT_DECIMALS)}, need ${amountUsdt})` };
      if (gas < MIN_GAS_WEI) return { ok: false, reason: 'insufficient_gas_okb' };
      return { ok: true };
    } catch (e) {
      // RPC/read failure is not a proven shortfall; let the send path decide (and fail
      // safe there) rather than silently skipping a payable claim forever.
      return { ok: true, reason: `preflight_unavailable: ${e instanceof Error ? e.message : String(e)}` };
    }
  },

  async sendUsdt(toWallet, amountUsdt, _note) {
    if (!isAddress(toWallet)) throw new Error(`payout target is not a valid address: ${toWallet}`);
    const { wallet, pub } = (cached ??= makeClients());
    const hash = await wallet.writeContract({
      address: USDT_ADDRESS,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [toWallet, toBaseUnits(amountUsdt)],
    });
    // Bound the wait: a slow RPC must not eat the watcher's 60s budget and starve other
    // claims. On timeout this throws — the transfer already broadcast, so the claim stays
    // 'sending' (pays-once holds) and next run surfaces it as stuck, never resent.
    await pub.waitForTransactionReceipt({ hash, timeout: 30_000 });
    return { txHash: hash };
  },
};
