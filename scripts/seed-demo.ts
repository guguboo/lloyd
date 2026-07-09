// scripts/seed-demo.ts
// Populates a lively, coherent public Ledger for the demo: quotes -> policies ->
// claims -> premium ledger events, using the real tiers. Idempotent: clears prior
// demo rows (everything but the seed pool event) and rewrites them.
// Buyer wallets are placeholders here; scripts/testnet-payouts.ts replaces each with a
// real X Layer wallet it anchors onchain, then settles the "sending" claims.
// Run: ./node_modules/.bin/tsx --env-file=.env.local scripts/seed-demo.ts
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const now = Date.now();
const hrs = (h: number) => new Date(now + h * 3600_000).toISOString();
type Tier = 'skiff' | 'frigate' | 'galleon';
type PolicyStatus = 'active' | 'expired' | 'claim_pending' | 'paid_out';

const PREMIUM: Record<Tier, number> = { skiff: 0.75, frigate: 1.5, galleon: 3.5 };

// [provider, buyerTag, tier, riskClass, jobValue, coverage, status, deadlineHrs]
// Spread across 5 providers, 3 tiers, 4 statuses. Per-provider live coverage stays
// under the 10%-of-pool cap and total outstanding under 50%.
const POLICIES: [string, string, Tier, 'A' | 'B' | 'C', number, number, PolicyStatus, number][] = [
  ['fletcher', 'p01', 'galleon', 'A', 50, 40.0, 'active', 72],
  ['marlowe', 'p02', 'frigate', 'B', 22, 17.6, 'active', 48],
  ['mallory', 'p03', 'frigate', 'B', 20, 16.0, 'active', 120],
  ['corwin', 'p04', 'skiff', 'C', 12, 9.6, 'active', 36],
  ['ashby', 'p05', 'galleon', 'A', 48, 38.4, 'active', 96],
  ['marlowe', 'p06', 'skiff', 'B', 14, 10.71, 'active', 60],
  ['mallory', 'p07', 'frigate', 'B', 30, 24.0, 'paid_out', -2],
  ['fletcher', 'p08', 'skiff', 'B', 14, 10.71, 'paid_out', -48],
  ['ashby', 'p09', 'galleon', 'A', 45, 36.0, 'paid_out', -12],
  ['corwin', 'p10', 'frigate', 'B', 25, 20.0, 'paid_out', -24],
  ['marlowe', 'p11', 'galleon', 'A', 42, 33.6, 'paid_out', -36],
  ['mallory', 'p12', 'skiff', 'C', 10, 8.0, 'expired', -18],
];

// [policyTag, trigger, amount]  — all become real onchain payouts via testnet-payouts.ts.
// Kept 'sending' (never 'pending'): a pending claim would be auto-settled by any watcher
// run — with a fixture hash under LLOYD_MODE=fixture — leaving an unverifiable ledger row.
const CLAIMS: [string, 'dispute_verdict' | 'delivery_timeout' | 'manual', number][] = [
  ['p07', 'dispute_verdict', 24.0],
  ['p08', 'dispute_verdict', 10.71],
  ['p09', 'delivery_timeout', 36.0],
  ['p10', 'delivery_timeout', 20.0],
  ['p11', 'dispute_verdict', 33.6],
];

async function main() {
  // wipe prior demo rows (keep the seed pool event)
  await db.from('claims').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await db.from('policies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await db.from('quotes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await db.from('ledger_events').delete().neq('kind', 'seed');

  const policyIds: Record<string, string> = {};
  for (const [provider, tag, tier, risk, jobValue, coverage, status, deadlineHrs] of POLICIES) {
    const buyer = `0x${tag}${'0'.repeat(38)}`.slice(0, 42); // placeholder, anchored later
    const { data: q, error: qe } = await db
      .from('quotes')
      .insert({
        provider_id: provider,
        buyer_wallet: buyer,
        job_value_usdt: jobValue,
        job_type: 'data-labeling',
        risk_class: risk,
        recommended_tier: tier,
        newcomer: false,
        status: 'bound',
      })
      .select('id')
      .single();
    if (qe) throw qe;

    const { data: p, error: pe } = await db
      .from('policies')
      .insert({
        quote_id: q!.id,
        provider_id: provider,
        buyer_wallet: buyer,
        job_ref: `job-${tag}`,
        job_value_usdt: jobValue,
        tier,
        coverage_usdt: coverage,
        premium_usdt: PREMIUM[tier],
        deadline_at: hrs(deadlineHrs),
        status,
      })
      .select('id')
      .single();
    if (pe) throw pe;
    policyIds[tag] = p!.id;

    await db.from('ledger_events').insert({
      kind: 'premium',
      amount_usdt: PREMIUM[tier],
      policy_id: p!.id,
      note: `premium ${tier}`,
    });
  }

  // claims are seeded 'sending'; testnet-payouts.ts turns each into a real onchain payout
  // (single source of settlements — no payout events here).
  await db.from('claims').insert(
    CLAIMS.map(([tag, trigger, amount]) => ({
      policy_id: policyIds[tag],
      trigger,
      amount_usdt: amount,
      status: 'sending',
      tx_hash: null,
    })),
  );

  console.log(`demo activity seeded: ${POLICIES.length} policies, ${CLAIMS.length} claims`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
