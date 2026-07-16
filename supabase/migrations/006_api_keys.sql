-- supabase/migrations/006_api_keys.sql
-- Per-wallet API keys for the keyed MCP endpoint. The raw token is never stored:
-- key_hash is sha256(token). A key is bound to the wallet that signed its issuance,
-- and tools enforce that the key acts only for that wallet.
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  wallet text not null,
  key_hash text not null unique,
  label text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_used_at timestamptz
);
alter table api_keys enable row level security;  -- deny-all: service_role only, like every table
