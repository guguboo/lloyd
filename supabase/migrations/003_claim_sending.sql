-- supabase/migrations/003_claim_sending.sql
-- Money-safety (decisions.md D7 / go-live H1): two-phase payout send.
-- The sendUsdt -> markClaimPaid crash window can double-send real USDT (the DB
-- ledger stays correct via one_payout_per_policy; the chain does not). The fix
-- introduces an intermediate 'sending' claim status: the executor moves a claim
-- pending -> sending BEFORE the on-chain transfer, so a crash between send and
-- finalize leaves the claim in 'sending' — never auto-retried (fail-safe), only
-- surfaced to an operator for an on-chain check.
--
-- Widen the claims.status check to allow the new intermediate state. Idempotent:
-- drop the existing constraint by name (found via the live schema) if present,
-- then add the widened one.
alter table claims drop constraint if exists claims_status_check;
alter table claims add constraint claims_status_check
  check (status in ('pending','sending','paid'));
