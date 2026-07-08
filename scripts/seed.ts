// scripts/seed.ts
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const pool = Number(process.env.SEED_POOL_USDT ?? 300);
  const { data: existing } = await db.from('ledger_events').select('id').eq('kind', 'seed').limit(1);
  if (!existing?.length) {
    await db.from('ledger_events').insert({ kind: 'seed', amount_usdt: pool, note: 'initial capital pool' });
    console.log(`seeded pool with ${pool} USDT`);
  } else console.log('pool already seeded, skipping');

  const dossiers = [
    { provider_id: 'marlowe', wallet_age_days: 40, completed_jobs: 12, total_volume_usdt: 300, dispute_rate: 0.05, avg_rating: 4.0, linked_wallets: [] as string[] },
    { provider_id: 'fletcher', wallet_age_days: 120, completed_jobs: 80, total_volume_usdt: 5000, dispute_rate: 0.01, avg_rating: 4.8, linked_wallets: [] as string[] },
    { provider_id: 'mallory', wallet_age_days: 30, completed_jobs: 10, total_volume_usdt: 200, dispute_rate: 0.05, avg_rating: 4.2, linked_wallets: ['0xMALLORY-BUYER'] },
  ];
  for (const d of dossiers) await db.from('provider_dossiers').upsert(d);

  for (const job_ref of ['job-demo-fail', 'job-demo-ok'])
    await db.from('demo_jobs').upsert({ job_ref, state: 'pending' });

  console.log('seed complete');
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
