// scripts/seed-demo.ts
// Populates a lively, coherent public Ledger for the demo: quotes -> policies ->
// claims -> payout ledger events, using the real tiers. Idempotent: clears prior
// demo rows (everything but the seed pool event) and rewrites them.
// Run: ./node_modules/.bin/tsx --env-file=.env.local scripts/seed-demo.ts
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const now = Date.now();
const hrs = (h: number) => new Date(now + h * 3600_000).toISOString();
type Tier = 'skiff' | 'frigate' | 'galleon';
type PolicyStatus = 'active' | 'expired' | 'claim_pending' | 'paid_out';

const PREMIUM: Record<Tier, number> = { skiff: 0.75, frigate: 1.5, galleon: 3.5 };

// [provider, buyerTag, tier, riskClass, jobValue, coverage, status, deadlineHrs]
const POLICIES: [string, string, Tier, 'A' | 'B' | 'C', number, number, PolicyStatus, number][] = [
  ['fletcher', 'a1', 'galleon', 'A', 60, 48.0, 'active', 72],
  ['marlowe', 'b2', 'frigate', 'B', 22, 17.6, 'active', 48],
  ['mallory', 'c3', 'frigate', 'B', 20, 16.0, 'active', 120],
  ['mallory', 'd4', 'skiff', 'B', 12, 9.6, 'claim_pending', -1],
  ['fletcher', 'e7', 'galleon', 'A', 50, 40.0, 'claim_pending', -3],
  ['marlowe', 'f5', 'skiff', 'B', 14, 10.71, 'paid_out', -48],
  ['fletcher', 'g6', 'frigate', 'A', 30, 24.0, 'expired', -24],
];

async function main() {
  // wipe prior demo rows (keep the seed pool event)
  await db.from('claims').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await db.from('policies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await db.from('quotes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await db.from('ledger_events').delete().neq('kind', 'seed');

  const policyIds: Record<string, string> = {};
  for (const [provider, tag, tier, risk, jobValue, coverage, status, deadlineHrs] of POLICIES) {
    const buyer = `0x${tag}${'0'.repeat(38)}`.slice(0, 42);
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

  // claims: one paid (with tx), one in-flight, two pending
  const TX = '0x9f4c2a7e18b3d605c1e94a7b2f0d83e6a4c159d27b8e034f6a1c9d5e2b70f4a8c';
  await db.from('claims').insert([
    { policy_id: policyIds['f5'], trigger: 'dispute_verdict', amount_usdt: 10.71, status: 'paid', tx_hash: TX, paid_at: new Date(now).toISOString() },
    { policy_id: policyIds['e7'], trigger: 'delivery_timeout', amount_usdt: 40.0, status: 'sending', tx_hash: null },
    { policy_id: policyIds['d4'], trigger: 'delivery_timeout', amount_usdt: 9.6, status: 'pending', tx_hash: null },
  ]);
  await db.from('ledger_events').insert({ kind: 'payout', amount_usdt: -10.71, policy_id: policyIds['f5'], tx_hash: TX, note: 'payout dispute_verdict' });

  console.log('demo activity seeded:', POLICIES.length, 'policies, 3 claims');
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
