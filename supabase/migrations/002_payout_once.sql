-- supabase/migrations/002_payout_once.sql
-- Money-safety (decisions.md D5): belt-and-braces pays-once at the DB layer.
-- markClaimPaid already guards idempotency via `.eq('status','pending')` on the
-- claims UPDATE; this partial unique index makes a second payout ledger event for
-- the same policy impossible even under a race.
create unique index one_payout_per_policy on ledger_events (policy_id) where kind = 'payout';
