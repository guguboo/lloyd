-- 004_enable_rls.sql
-- Defense in depth (M-1). All access today is server-side via the service-role key, which
-- BYPASSES row level security — so enabling RLS with NO policies changes nothing for the
-- backend, but guarantees that if an anon/publishable key is ever added to a client, every
-- table is denied by default instead of being world-readable/writable.
alter table provider_dossiers enable row level security;
alter table quotes            enable row level security;
alter table policies          enable row level security;
alter table claims            enable row level security;
alter table ledger_events     enable row level security;
alter table demo_jobs         enable row level security;
-- No policies are created on purpose: anon/authenticated roles get zero rows; only the
-- service_role (used exclusively by the server) bypasses RLS and retains full access.
