# Security & money-safety model

Lloyd moves real value, so the money paths are built to fail safe. This document is the
checked-in summary of that design and the gates before mainnet exposure.

## Operating modes (`LLOYD_MODE`)

| Mode | Money | Endpoint auth | Use |
|------|-------|---------------|-----|
| `fixture` (default) | none — payouts are logged, not sent | open | build, demo the UI, safe on public traffic |
| `testnet` | real X Layer **testnet** USD₮0 | **API key required** | live end-to-end demo with real (valueless) money |
| `real` | mainnet USDT/USDG | required | **gated — not wired** until the go-live checklist below is met |

## Invariants that hold today

- **Pays once.** `claims.policy_id` is unique and `ledger_events` carries a partial unique
  index (`one_payout_per_policy`). `openClaim` treats `23505` as "already claimed";
  `markClaimPaid` is idempotent and self-heals a committed-update / failed-ledger crash.
- **At-most-once on-chain send.** A compare-and-set moves a claim `pending → sending`
  *before* the transfer. A crash or timeout in the send window leaves it `sending`, which is
  **never auto-retried** — it is surfaced for an operator (`POST /api/admin/resolve-claim`).
- **Pre-flight before commit.** Settlement checks treasury funds + gas before the CAS, so a
  shortfall leaves the claim retryable instead of wedged.
- **Fail-closed job state.** An unknown/unverifiable `job_ref` resolves to a non-payable
  state; only a tracked job can trigger a payout.
- **Nothing is insured that isn't on-chain.** Off fixture mode, a bind requires two verified
  USDT transfers on X Layer: `job_tx` (buyer → the provider's dossier wallet, ≥ the quoted job
  value, recent, before the deadline) and `premium_tx` (buyer → the treasury, ≥ the tier
  price). A fabricated job cannot be insured, and an uncollected premium cannot be booked.
- **Each payment backs exactly one policy.** `unique(job_tx)` blocks double-insuring a job;
  `unique(premium_tx)` blocks reusing one premium payment. Both are DB constraints.
- **Delivery is proven, not asserted.** The provider signs an EIP-191 attestation bound to the
  policy id + job tx, with the wallet that received the job payment. A buyer cannot forge it,
  and it cannot be replayed onto another policy. No attestation by the deadline → the claim
  pays.
- **Self-dealing controls.** Blocked at bind: buyer == provider wallet, known linked wallets, a
  buyer+provider pair that already produced a payout, and buyers whose policies convert to
  payouts at an abnormal rate (`lib/fraud.ts`).
- **Solvency in the database.** Coverage ≤ 50% of the pool, no provider > 10%, one active
  policy per buyer+provider, enforced at the store boundary, not just in app logic.
- **Authenticated privileged routes.** The watcher and admin endpoints require a
  constant-time bearer check (`CRON_SECRET`); the MCP endpoint requires an API key whenever
  money can move.
- **Kill switches.** `KILL_SWITCH=true` halts new binds; `SETTLEMENT_PAUSED=true` halts all
  payouts.

## Why there is no escrow integration

OKX's agent payment rails do not escrow a job. **x402** and **a2a-pay** settle *instantly* —
the buyer signs, the transfer lands, and there is no hold, no delivery condition, no dispute
window and no refund path. The `escrowContract` in the MPP session flow is a **prepaid payment
channel** for metered billing (open → vouchers → close); it escrows a *balance*, not a *job*,
and nothing in it records whether work was delivered.

So there is no on-chain object Lloyd could watch to learn "the job failed" — and that absence
is exactly the risk Lloyd sells against: **in x402 the buyer pays first and has zero recourse.**

Lloyd therefore anchors a policy to the facts that *are* on-chain (the buyer paid the provider;
the buyer paid Lloyd) and takes the one fact that isn't — delivery — as a signature from the
provider's own key. If OKX ships a real job escrow, `lib/okx/fixtures.ts` (`jobMonitor`) is the
single seam to read it from.

## Go-live gate (before `LLOYD_MODE=real` on a public endpoint)

1. **Production signer.** Replace the env-var key with a TEE (OKX Agentic Wallet) or MPC/KMS
   signer with per-tx and daily spend caps and a settlement-contract allowlist. Separate the
   hot per-call signer from the cold treasury.
2. **Arbitration.** A provider who attests delivery but ships garbage cannot be challenged
   today — coverage is for *non-delivery*, not for quality. Real dispute resolution needs an
   arbiter (OKX's, or a staked one).
3. **Deeper linkage detection.** Extend `lib/fraud.ts` from the pair/rate heuristics to an
   on-chain funding-graph analysis (common funder, wash round-trips) or a reputation feed.
4. **Shared rate limiting.** The MCP limiter is per-instance and in-memory; move it to a shared
   store before real traffic.

## Reporting

This is a hackathon project. For a real deployment, route disclosures to a monitored
security contact and add rate-limited, authenticated incident tooling.
