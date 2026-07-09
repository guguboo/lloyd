// scripts/testnet-payouts.ts
// Turns the seeded "paid"/"sending" claims into REAL, verifiable X Layer testnet
// payouts: sends an actual OKB transfer from Lloyd's testnet treasury to a fresh
// recipient per claim, then writes the real tx hash + recipient into the DB so the
// Ledger's "Verify" links resolve on the testnet explorer.
// Prereq: TESTNET_PRIVATE_KEY funded with testnet OKB (X Layer faucet).
// Run: ./node_modules/.bin/tsx --env-file=.env.local scripts/testnet-payouts.ts
import { createClient } from '@supabase/supabase-js';
import {
  createWalletClient,
  createPublicClient,
  http,
  defineChain,
  parseEther,
  formatEther,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';

const xLayerTestnet = defineChain({
  id: 1952,
  name: 'X Layer Testnet',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: { default: { http: ['https://testrpc.xlayer.tech'] } },
});

const PAYOUT_OKB = '0.0002'; // nominal per payout; the point is a real, verifiable tx

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const account = privateKeyToAccount(process.env.TESTNET_PRIVATE_KEY as `0x${string}`);
const wallet = createWalletClient({ account, chain: xLayerTestnet, transport: http() });
const pub = createPublicClient({ chain: xLayerTestnet, transport: http() });

async function main() {
  const bal = await pub.getBalance({ address: account.address });
  console.log(`Treasury ${account.address}: ${formatEther(bal)} OKB`);
  if (bal === BigInt(0)) {
    console.error(`\nTreasury is unfunded. Fund it via the X Layer testnet faucet:\n  https://web3.okx.com/xlayer/faucet\n  address: ${account.address}\nThen re-run this script.`);
    process.exit(1);
  }

  // Claims to make real: everything not already carrying a real onchain tx.
  const { data: claims, error } = await db
    .from('claims')
    .select('id, policy_id, amount_usdt, status')
    .in('status', ['paid', 'sending']);
  if (error) throw error;
  if (!claims?.length) {
    console.log('No paid/sending claims to settle onchain. Run scripts/seed-demo.ts first.');
    return;
  }

  for (const c of claims) {
    const recipient = privateKeyToAccount(generatePrivateKey()).address;
    const hash = await wallet.sendTransaction({ to: recipient, value: parseEther(PAYOUT_OKB) });
    await pub.waitForTransactionReceipt({ hash });
    console.log(`claim ${c.id.slice(0, 8)} -> ${hash}`);

    await db.from('claims').update({ status: 'paid', tx_hash: hash, paid_at: new Date().toISOString() }).eq('id', c.id);
    await db.from('policies').update({ buyer_wallet: recipient, status: 'paid_out' }).eq('id', c.policy_id);
    await db.from('ledger_events').insert({
      kind: 'payout', amount_usdt: -Number(c.amount_usdt), policy_id: c.policy_id, tx_hash: hash, note: 'testnet payout',
    });
  }
  console.log(`\nDone. ${claims.length} real X Layer testnet payouts written to the ledger.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
