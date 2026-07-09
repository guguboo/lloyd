// scripts/testnet-payouts.ts
// Populates the Ledger with REAL, verifiable X Layer testnet transactions:
//   Phase 1 (anchor): every policy gets a fresh buyer wallet, funded by a nominal OKB
//     transfer from Lloyd's treasury — a real onchain record so each policy is verifiable.
//   Phase 2 (settle): every "sending" claim becomes a real OKB payout from the treasury to
//     that policy's buyer wallet; the tx hash + paid_out status are written back.
// Idempotent: policies already anchored (real hex buyer) are skipped; claims already
// carrying a tx are skipped.
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

const ANCHOR_OKB = '0.00002'; // nominal per-policy onchain anchor
const PAYOUT_OKB = '0.0002'; // nominal per-claim payout; the point is a real, verifiable tx

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const account = privateKeyToAccount(process.env.TESTNET_PRIVATE_KEY as `0x${string}`);
const wallet = createWalletClient({ account, chain: xLayerTestnet, transport: http() });
const pub = createPublicClient({ chain: xLayerTestnet, transport: http() });

const isRealAddress = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a);

async function send(to: string, okb: string): Promise<`0x${string}`> {
  const hash = await wallet.sendTransaction({ to: to as `0x${string}`, value: parseEther(okb) });
  await pub.waitForTransactionReceipt({ hash });
  return hash;
}

async function main() {
  const bal = await pub.getBalance({ address: account.address });
  console.log(`Treasury ${account.address}: ${formatEther(bal)} OKB`);
  if (bal === BigInt(0)) {
    console.error(`\nTreasury is unfunded. Fund it via the X Layer testnet faucet:\n  https://web3.okx.com/xlayer/faucet\n  address: ${account.address}\nThen re-run this script.`);
    process.exit(1);
  }

  // Phase 1: anchor every policy onchain with a fresh, real buyer wallet.
  const { data: policies, error: pErr } = await db
    .from('policies')
    .select('id, buyer_wallet')
    .order('created_at');
  if (pErr) throw pErr;
  let anchored = 0;
  for (const p of policies ?? []) {
    if (isRealAddress(p.buyer_wallet)) continue; // already anchored
    const buyer = privateKeyToAccount(generatePrivateKey()).address;
    const hash = await send(buyer, ANCHOR_OKB);
    await db.from('policies').update({ buyer_wallet: buyer }).eq('id', p.id);
    console.log(`anchored policy ${p.id.slice(0, 8)} -> ${buyer.slice(0, 10)}… (${hash.slice(0, 10)}…)`);
    anchored++;
  }

  // Phase 2: settle every unpaid claim to its policy's (now real) buyer wallet.
  const { data: claims, error: cErr } = await db
    .from('claims')
    .select('id, policy_id, amount_usdt, tx_hash')
    .eq('status', 'sending')
    .is('tx_hash', null);
  if (cErr) throw cErr;
  let paid = 0;
  for (const c of claims ?? []) {
    const { data: pol, error: e } = await db
      .from('policies')
      .select('buyer_wallet')
      .eq('id', c.policy_id)
      .single();
    if (e) throw e;
    const hash = await send(pol.buyer_wallet, PAYOUT_OKB);
    await db.from('claims').update({ status: 'paid', tx_hash: hash, paid_at: new Date().toISOString() }).eq('id', c.id);
    await db.from('policies').update({ status: 'paid_out' }).eq('id', c.policy_id);
    await db.from('ledger_events').insert({
      kind: 'payout', amount_usdt: -Number(c.amount_usdt), policy_id: c.policy_id, tx_hash: hash, note: 'testnet payout',
    });
    console.log(`paid claim ${c.id.slice(0, 8)} -> ${hash.slice(0, 12)}…`);
    paid++;
  }

  console.log(`\nDone. Anchored ${anchored} policies, settled ${paid} claims — all real X Layer testnet txs.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
