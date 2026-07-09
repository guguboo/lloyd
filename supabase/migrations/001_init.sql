-- supabase/migrations/001_init.sql
-- Lloyd micro-insurance schema.
-- Safety guarantees live here as DB constraints, not application logic:
--   pays-once           -> claims.policy_id UNIQUE
--   single-use quotes   -> policies.quote_id UNIQUE (+ quote status CAS in the store)
--   one active policy    -> partial unique index (buyer_wallet, provider_id) where status = 'active'
-- Tiered fixed pricing (decisions.md D1/D2): quotes carry a recommended_tier + newcomer
-- flag; premium/coverage are recomputed deterministically at bind time.

create table provider_dossiers (
  provider_id text primary key,
  wallet_age_days int not null,
  completed_jobs int not null,
  total_volume_usdt numeric not null default 0,
  dispute_rate numeric not null default 0,
  avg_rating numeric,
  linked_wallets text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table quotes (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  buyer_wallet text not null,
  job_value_usdt numeric not null,
  job_type text not null,
  risk_class text not null check (risk_class in ('A','B','C')),
  recommended_tier text not null check (recommended_tier in ('skiff','frigate','galleon')),
  newcomer boolean not null default false,
  status text not null default 'open' check (status in ('open','bound')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '1 hour'
);

create table policies (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null unique references quotes(id),
  provider_id text not null,
  buyer_wallet text not null,
  job_ref text not null,
  job_value_usdt numeric not null,
  tier text not null check (tier in ('skiff','frigate','galleon')),
  coverage_usdt numeric not null,
  premium_usdt numeric not null,
  deadline_at timestamptz not null,
  status text not null default 'active'
    check (status in ('active','expired','claim_pending','paid_out')),
  created_at timestamptz not null default now()
);
create unique index one_active_policy_per_pair
  on policies (buyer_wallet, provider_id) where status = 'active';

create table claims (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null unique references policies(id),  -- pays-once, in the DB
  trigger text not null check (trigger in ('dispute_verdict','delivery_timeout','manual')),
  amount_usdt numeric not null,
  status text not null default 'pending' check (status in ('pending','paid')),
  tx_hash text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table ledger_events (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('seed','premium','payout')),
  amount_usdt numeric not null,   -- positive = into pool, negative = out
  policy_id uuid,
  tx_hash text,
  note text,
  created_at timestamptz not null default now()
);

create table demo_jobs (
  job_ref text primary key,
  state text not null default 'pending'
    check (state in ('pending','delivered','provider_fault'))
);
