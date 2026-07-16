// scripts/seed-demo.ts
// Seeds a small, honest, mixed-outcome demo for the public Ledger, sized to the real
// (~USD) testnet treasury. Every policy is seeded 'active' with a matching demo_jobs row;
// running the settlement watcher (LLOYD_MODE=testnet) then produces the real end state:
//   pending + future deadline → stays IN FORCE
//   delivered                 → LAPSES (job done successfully, no claim)
//   provider_fault / past-due → claim opened + REAL USDT payout
// Buyers are fresh, real X Layer addresses (valid payout targets).
// Run:   ./node_modules/.bin/tsx --env-file=.env.local scripts/seed-demo.ts
// Then settle (server in testnet mode):
//        curl -H "Authorization: Bearer $CRON_SECRET" <baseUrl>/api/watcher
import { createClient } from '@supabase/supabase-js';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const now = Date.now();
const hrs = (h: number) => new Date(now + h * 3600_000).toISOString();
const round2 = (n: number) => Math.round(n * 100) / 100;

type Tier = 'skiff' | 'frigate' | 'galleon';
type Risk = 'A' | 'B' | 'C';
type JobState = 'pending' | 'delivered' | 'provider_fault';
const PREMIUM: Record<Tier, number> = { skiff: 0.75, frigate: 1.5, galleon: 3.5 };

// Book pool ≈ the real USDT reserve, so solvency gates against real liquidity.
const POOL_USDT = 15;

// [provider, tier, risk, jobValue, jobState, deadlineHrs]. Coverage = 0.8 × jobValue
// (the 80% cap binds at these small values). Kept tiny so real payouts fit the ~USD pool.
const SPECS: [string, Tier, Risk, number, JobState, number][] = [
  // — in force: job still running, deadline ahead —
  ['fletcher', 'galleon', 'A', 1.5, 'pending', 72],
  ['marlowe', 'frigate', 'B', 1.0, 'pending', 48],
  ['ashby', 'skiff', 'A', 1.25, 'pending', 96],
  ['corwin', 'frigate', 'B', 1.0, 'pending', 36],
  // — delivered successfully: coverage lapses, NO claim —
  ['marlowe', 'galleon', 'A', 3.0, 'delivered', -36],
  ['fletcher', 'skiff', 'B', 2.0, 'delivered', -48],
  ['mallory', 'frigate', 'B', 1.5, 'delivered', -18],
  ['corwin', 'skiff', 'C', 1.0, 'delivered', -24],
  // — failed: settlement pays real USDT —
  ['ashby', 'galleon', 'A', 2.0, 'provider_fault', -12],
  ['mallory', 'skiff', 'B', 1.0, 'pending', -6],
  ['fletcher', 'frigate', 'B', 1.5, 'provider_fault', -8],
];

async function main() {
  // Wipe prior demo rows. Order respects FKs (claims + ledger_events reference policies).
  await db.from('claims').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await db.from('ledger_events').delete().neq('kind', '__none__');
  await db.from('policies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await db.from('quotes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await db.from('demo_jobs').delete().neq('job_ref', '__none__');

  // Fresh pool ≈ real reserve. No premium events: premiums aren't collected on testnet, so
  // crediting them would inflate the book above the on-chain balance (see SECURITY.md / C-3).
  await db.from('ledger_events').insert({ kind: 'seed', amount_usdt: POOL_USDT, note: 'demo capital pool' });

  let i = 0;
  for (const [provider, tier, risk, jobValue, jobState, deadlineHrs] of SPECS) {
    const jobRef = `job-demo-${i++}`;
    const buyer = privateKeyToAccount(generatePrivateKey()).address; // fresh, real payout target
    const coverage = round2(Math.min(0.8 * jobValue, 50));

    const { data: q, error: qe } = await db.from('quotes').insert({
      provider_id: provider, buyer_wallet: buyer, job_value_usdt: jobValue,
      job_type: 'agent-task', risk_class: risk, recommended_tier: tier, newcomer: false, status: 'bound',
    }).select('id').single();
    if (qe) throw qe;

    const { error: pe } = await db.from('policies').insert({
      quote_id: q!.id, provider_id: provider, buyer_wallet: buyer, job_ref: jobRef,
      job_value_usdt: jobValue, tier, coverage_usdt: coverage, premium_usdt: PREMIUM[tier],
      deadline_at: hrs(deadlineHrs), status: 'active',
    });
    if (pe) throw pe;

    // The real job outcome the watcher reads. Unknown refs fail closed, so every policy needs
    // its row here — that is why 'delivered' jobs lapse cleanly instead of phantom-paying.
    const { error: je } = await db.from('demo_jobs').upsert({ job_ref: jobRef, state: jobState });
    if (je) throw je;
  }

  console.log(`seeded ${SPECS.length} active policies + demo_jobs (pool $${POOL_USDT}). Run the watcher (testnet mode) to settle.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
