// scripts/rehearsal.ts
// Runs Lloyd's whole lifecycle against a live instance and asserts every step: the
// thing to run before a deploy and on camera. Quote -> fraud decline -> bind -> deadline
// blown -> automatic settlement -> pays-once. If the target server runs LLOYD_MODE=testnet,
// the payout is a REAL X Layer testnet transaction and its hash is printed + verified.
//
// Usage: ./node_modules/.bin/tsx --env-file=.env.local scripts/rehearsal.ts [baseUrl] [--keep]
//   baseUrl defaults to http://localhost:3000. --keep leaves the demo rows on the Ledger
//   (for the video); by default the rehearsal cleans up after itself.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createClient } from '@supabase/supabase-js';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import assert from 'node:assert/strict';

const args = process.argv.slice(2);
const KEEP = args.includes('--keep');
const BASE = (args.find((a) => !a.startsWith('--')) ?? 'http://localhost:3000').replace(/\/$/, '');

// This script sends CRON_SECRET (Bearer) to BASE. Refuse an unexpected host so a typo or
// bad argv can't leak the secret; --allow-host overrides for a custom deploy domain.
{
  const host = new URL(BASE).hostname;
  const trusted = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.vercel.app');
  if (!trusted && !args.includes('--allow-host')) {
    console.error(`✋ refusing to send CRON_SECRET to untrusted host "${host}" — pass --allow-host to override.`);
    process.exit(1);
  }
}
const DEADLINE_SEC = Number(process.env.REHEARSAL_DEADLINE_SEC ?? 45);
// Small enough that the new coverage fits under marlowe's 10%-of-pool exposure cap
// alongside the seeded demo policies.
const JOB_USDT = Number(process.env.REHEARSAL_JOB_USDT ?? 10);

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const stamp = Date.now();
const JOB = `job-rehearsal-${stamp}`;
const PEPYS = privateKeyToAccount(generatePrivateKey()).address; // fresh, valid payout target
const TIER_PRICES = [0.75, 1.5, 3.5];

async function call(client: Client, name: string, a: Record<string, unknown>) {
  const res = await client.callTool({ name, arguments: a });
  const text = (res.content as { type: string; text: string }[])[0].text;
  console.log(`\n▸ ${name}(${JSON.stringify(a)})\n  → ${text}`);
  return JSON.parse(text);
}

const watcher = () =>
  fetch(`${BASE}/api/watcher`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })
    .then((r) => r.json());

async function main() {
  console.log(`Rehearsal → ${BASE}  (buyer ${PEPYS})`);
  const transport = new StreamableHTTPClientTransport(new URL(`${BASE}/api/mcp/mcp`));
  const client = new Client({ name: 'pepys', version: '1.0.0' });
  await client.connect(transport);

  // job starts pending; the watcher reads this state
  await db.from('demo_jobs').upsert({ job_ref: JOB, state: 'pending' });

  // 1. Quote marlowe for a small job
  const quote = await call(client, 'get_quote', {
    provider_id: 'marlowe', buyer_wallet: PEPYS, job_value_usdt: JOB_USDT, job_type: 'research',
  });
  assert.equal(quote.decision, 'quote', 'marlowe should be quotable');
  const rec = quote.recommended_tier as 'skiff' | 'frigate' | 'galleon';
  const cover = quote.tiers[rec].coverage_usdt as number;
  assert.ok(cover > 0 && cover <= JOB_USDT * 0.8, `coverage ${cover} must be >0 and <= 80% of $${JOB_USDT}`);

  // 2. Fraud check: mallory is linked to this buyer → decline
  const fraud = await call(client, 'get_quote', {
    provider_id: 'mallory', buyer_wallet: '0xMALLORY-BUYER', job_value_usdt: 20, job_type: 'research',
  });
  assert.equal(fraud.decision, 'decline');
  assert.equal(fraud.reason, 'linked_wallets', 'linked buyer must be declined');

  // 3. Bind at the recommended tier with a short deadline
  const deadline = new Date(Date.now() + DEADLINE_SEC * 1000).toISOString();
  const bound = await call(client, 'bind_policy', {
    quote_id: quote.quote_id, tier: rec, job_ref: JOB, deadline_at: deadline,
  });
  assert.equal(bound.ok, true, 'bind should succeed');
  assert.ok(TIER_PRICES.includes(bound.premium_usdt), `premium ${bound.premium_usdt} must be a tier price`);
  const policyId = bound.policy_id as string;

  // 4. Marlowe blows the deadline. Wait it out.
  console.log(`\n… waiting ${DEADLINE_SEC + 5}s for the deadline to pass …`);
  await new Promise((r) => setTimeout(r, (DEADLINE_SEC + 5) * 1000));

  // 5. Watcher settles: opens the claim and pays it in one run
  const run = await watcher();
  console.log('\n▸ watcher →', JSON.stringify(run));
  assert.ok(run.paidOut.includes(policyId), 'policy should have paid out');

  // 6. Policy is paid_out; the claim carries a real tx hash
  const status = await call(client, 'get_policy', { policy_id: policyId });
  assert.equal(status.status, 'paid_out');
  const { data: claim } = await db.from('claims').select('tx_hash').eq('policy_id', policyId).single();
  const tx = claim?.tx_hash as string | undefined;
  assert.ok(tx, 'claim must carry a tx hash');
  const real = /^0x[0-9a-fA-F]{64}$/.test(tx!);

  // 7. Pays-once: a second watcher run settles nothing
  const again = await watcher();
  assert.equal(again.paidOut.length, 0, 'no double payout');

  console.log('\n✅ rehearsal complete: quote → fraud decline → bind → fail → automatic payout → pays-once verified');
  if (real) {
    console.log(`   REAL X Layer testnet payout: ${tx}`);
    console.log(`   verify: https://www.oklink.com/x-layer-testnet/tx/${tx}`);
  } else {
    console.log(`   fixture mode — placeholder hash ${tx} (set LLOYD_MODE=testnet for a real onchain payout)`);
  }

  await client.close();

  if (!KEEP) {
    await db.from('ledger_events').delete().eq('policy_id', policyId);
    await db.from('claims').delete().eq('policy_id', policyId);
    await db.from('policies').delete().eq('id', policyId);
    await db.from('quotes').delete().eq('id', quote.quote_id);
    await db.from('demo_jobs').delete().eq('job_ref', JOB);
    console.log('   (cleaned up rehearsal rows; pass --keep to leave them on the Ledger)');
  }
}
main().catch((e) => { console.error('\n❌ rehearsal failed:', e); process.exit(1); });
