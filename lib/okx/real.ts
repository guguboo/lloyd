// lib/okx/real.ts — real settlement on X Layer testnet. Every payout is an actual
// onchain OKB transfer from Lloyd's treasury wallet to the buyer, returning the real tx
// hash the Ledger surfaces. A nominal OKB value proves the rail end-to-end; the dollar
// figures stay USDT-denominated (see the Ledger legend).
// Server-only: reads TESTNET_PRIVATE_KEY. Never import this from client code.
import {
  createWalletClient,
  createPublicClient,
  http,
  defineChain,
  parseEther,
  isAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { Treasury } from './types';

const xLayerTestnet = defineChain({
  id: 1952,
  name: 'X Layer Testnet',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: { default: { http: ['https://testrpc.xlayer.tech'] } },
});

const PAYOUT_OKB = process.env.TESTNET_PAYOUT_OKB ?? '0.0002'; // nominal per-payout

// Built lazily so a missing key only errors when a real payout is actually attempted,
// never at import time (keeps fixture/testnet mode selection clean). The inferred
// ReturnType keeps the account/chain bound so sendTransaction typechecks with just to+value.
function makeClients() {
  const pk = process.env.TESTNET_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk) throw new Error('TESTNET_PRIVATE_KEY must be set for testnet settlement');
  const account = privateKeyToAccount(pk);
  return {
    wallet: createWalletClient({ account, chain: xLayerTestnet, transport: http() }),
    pub: createPublicClient({ chain: xLayerTestnet, transport: http() }),
  };
}
let cached: ReturnType<typeof makeClients> | null = null;

export const testnetTreasury: Treasury = {
  async sendUsdt(toWallet, _amountUsdt, _note) {
    if (!isAddress(toWallet)) throw new Error(`payout target is not a valid address: ${toWallet}`);
    const { wallet, pub } = (cached ??= makeClients());
    const hash = await wallet.sendTransaction({ to: toWallet, value: parseEther(PAYOUT_OKB) });
    // Bound the wait: a slow RPC must not eat the watcher's 60s maxDuration and starve
    // other pending claims. On timeout this throws — the tx already sent, so the claim
    // stays 'sending' (pays-once holds) and next run surfaces it as stuck, never resent.
    await pub.waitForTransactionReceipt({ hash, timeout: 30_000 });
    return { txHash: hash };
  },
};
