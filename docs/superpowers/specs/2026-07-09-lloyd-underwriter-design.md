# Lloyd — Design Spec

**Date:** 2026-07-09
**Project:** OKX.AI Genesis Hackathon submission (deadline July 17, 2026, 23:59 UTC)
**One-liner:** Lloyd is the underwriter of the agent economy — per-job micro-insurance for agent work on OKX.AI, priced from onchain reputation, with claims settled automatically by objective onchain events.

---

## 1. Context & positioning

OKX.AI (live July 1, 2026) is a marketplace where agents hire each other, pay in USDT/USDG via Agentic Wallets, and build onchain reputation. It has payments, escrow (A2A), pay-per-call (A2MCP), and a staked dispute network — but **nobody prices and carries the risk of an agent failing a job**.

- Enterprise AI insurance exists (AIUC $50M policies, Munich Re aiSure, Armilla) — slow, human-audited, annual, enterprise-scale.
- The Agentic Risk Standard (Apr 2026; Microsoft Research, Columbia, DeepMind, Virtuals, T54) explicitly proposes third-party underwriting of agent tasks — **as a framework, with no shipped implementation**.
- Gap Lloyd fills: micro-policies ($5–50 jobs), priced in seconds from onchain data, machine-to-machine, parametric claims.

**Name:** Lloyd — after Edward Lloyd's coffee house (1686), the birthplace of underwriting.
**Target tracks:** Creative Genius / Best Product. **Pitch line:** "They proposed the standard in April; we shipped the first implementation."

## 2. Product definition

Lloyd is an **A2MCP pay-per-call ASP**. A buyer agent about to hire a provider agent calls Lloyd to price the risk of that provider failing, pays a premium, and receives a bound policy. If the provider fails (dispute lost or delivery timeout), Lloyd **automatically pays the buyer 80% of the job value** from its capital pool. No claim forms, no adjusters — the settlement trigger is an objective onchain event.

**v1 insures exactly one risk:** buyer-side delivery risk on a specific job. Not provider liability, not subjective quality, not cross-marketplace anything.

## 3. Requirements

### Functional
1. Quote: given `(provider_id, job_value, job_type)`, return premium + terms or Decline, in seconds, from onchain reputation data.
2. Bind: convert a quote into an active policy via a paid A2MCP call; premium settles to Lloyd's Agentic Wallet.
3. Watch: monitor each insured job (escrow state, deadline, dispute status).
4. Settle: on trigger (dispute verdict against provider, or delivery timeout past insured deadline), pay 80% of job value to the buyer's wallet automatically; close policy; a policy pays at most once.
5. Ledger: public dashboard showing pool balance, outstanding coverage, policies written, claims paid — every entry linked to an onchain tx.
6. Demo agents: Marlowe (deliberately flaky provider) and Pepys (insured buyer) for rehearsal and filming.

### Non-functional
- Pricing engine is a pure deterministic function — no LLM in any money path.
- Any data-source timeout during underwriting → Decline. Never guess.
- Kill-switch env flag: stops new policies immediately; existing policies always honored.
- All treasury movements: DB row + onchain tx hash, publicly visible.

## 4. Scope

**In:** 4 MCP tools · rule-based pricing · policy store · watcher · automated payouts from seeded pool (200–500 USDT real, small) · Lloyd's Ledger page · demo agent pair · landing/docs page · 90s demo video.

**Out (pitch as roadmap only):** ML pricing, provider-side coverage, certification-linked discounts, reinsurance, cross-marketplace credit data.

## 5. Architecture

Single deployable. TypeScript end-to-end.

```
┌─ Next.js app (Vercel) ─────────────────────────────┐
│  /mcp            MCP endpoint (the ASP surface)     │
│  /               Lloyd's Ledger (public dashboard)  │
│  /api/watcher    Vercel Cron: poll jobs, settle     │
│  lib/underwrite  pricing engine (pure, testable)    │
│  lib/treasury    payout + solvency guards           │
└──────────┬──────────────────────┬──────────────────┘
      Supabase Postgres      OKX Onchain OS
      (quotes, policies,     (Agentic Wallet: premiums in,
       claims, ledger)        payouts out; Market/rep data)
```

Onchain OS integration surface (from docs): Wallet (TEE-secured keys), Market data, Payments on the APP protocol; capabilities packaged as Skills + MCP server + Open API.

## 6. ASP surface — MCP tools

| Tool | Paid? | Behavior |
|---|---|---|
| `get_quote(provider_id, job_value, job_type)` | Free | Pull provider onchain record → risk class A/B/C/Decline → premium, terms, single-use `quote_id` (expires 1h) |
| `bind_policy(quote_id)` | **Paid — premium is the call price** | Validates quote, records policy, returns `policy_id` + certificate reference |
| `get_policy(policy_id)` | Free | active / expired / claim_pending / paid_out |
| `file_claim(policy_id, job_ref)` | Free | Manual fallback trigger; normally the watcher settles automatically |

## 7. Risk engine v1 — deterministic scorecard

| Signal | Effect |
|---|---|
| Wallet age, completed jobs, total volume | Base risk class A/B/C |
| Dispute rate, rating trend | Class modifier |
| No/thin history | Newcomer cap: max $10 coverage, class C |
| Buyer–provider wallet linkage (shared funding, transfer history) | **Decline** (anti-self-dealing) |
| Data source timeout | **Decline** |

**Premium** = `job_value × base_rate(class)` — A: 3%, B: 7%, C: 15%; floor $0.50.
Rates are conservative-by-design for cold start; stated in pitch as "learns as the economy accrues loss data."

## 8. Coverage terms (decided)

- **Payout ratio: 80% co-insurance** — buyer keeps skin in the game (moral-hazard control, standard practice, pool longevity).
- Per-policy coverage cap: **$50**.
- One active policy per buyer–provider pair.
- Policy attaches to one specific job reference with an explicit delivery deadline.

## 9. Treasury & solvency — enforced in code

- Total outstanding coverage ≤ **50% of pool balance**; binds that would breach it are refused.
- Per-provider exposure ≤ **10% of pool** (correlated-failure defense).
- Claim-velocity limit: max 2 paid claims per buyer wallet per rolling 7 days.
- Kill-switch stops selling, never stops paying.
- Every movement: DB row + onchain tx hash on the public Ledger.

## 10. Settlement

Watcher (Vercel Cron) polls each active policy's job. Payout triggers, in priority order:
1. **Dispute verdict against provider** (if verdicts are API-readable — unknown #2 below).
2. **Delivery timeout** — escrow unreleased past the insured deadline.

Trigger → payout tx (80% of job value) from Agentic Wallet to buyer → policy closed → Ledger updated. **Pays-once enforced by DB constraint**, not application logic. Watcher is stateless and re-runnable.

## 11. Fraud defenses (v1)

1. Payouts keyed to independent events (staked dispute network verdict / onchain escrow state) — Lloyd never adjudicates its own claims.
2. Wallet-graph linkage check at quote time → Decline linked pairs.
3. Newcomer caps ($10) starve sybil farming.
4. Per-pair policy limit + claim-velocity limits.
5. Residual risk accepted and priced into conservative base rates.

## 12. Error handling

- Single-use quote IDs — no double-bind.
- Payout failure → retry queue + alert; policy stays claim_pending until tx confirms.
- All money ops in DB transactions keyed to onchain tx hashes.
- OKX API degradation → kill-switch selling; settlement retries continue.

## 13. Testing

- Golden-case unit tests on the pricing engine (each rule, each class boundary, decline paths).
- One scripted end-to-end lifecycle with Marlowe & Pepys on real rails at $1 scale: quote → bind → fail → payout.
- Failure drill rehearsed before filming the real demo.

## 14. Demo (≤90s, X post with #OKXAI)

Split screen. Two buyers hire Marlowe for identical $20 jobs — Pepys buys a $1.40 Lloyd policy (class B, 7%), the other doesn't. Marlowe blows the deadline. Left: uninsured buyer stares at a dispute form. Right: watcher catches the timeout, **16 USDT (80%) lands in Pepys's wallet on camera**, Ledger shows the claim paid. Closing card: *"In 1686, strangers learned to trade across oceans because a man named Lloyd gave them a room to price risk. Agents just got theirs."*

## 15. Plan (today = July 9)

| Date | Deliverable |
|---|---|
| Jul 9 | OKX onboarding: Agentic Wallet, **start ASP registration (human gate first)**. Verify 3 unknowns. Claim X handle + domain |
| Jul 10 | Skeleton: Next.js + MCP tools stubbed + Supabase schema + pricing engine on fixtures |
| Jul 11 | Real reputation data in pricing · golden tests · paid bind flow |
| Jul 12 | Watcher + settlement + real payout ($1 scale) · Ledger dashboard |
| Jul 13 | Full rehearsal · hardening · kill-switch · ASP review submission final |
| Jul 14 | Landing + docs · film & cut demo video |
| Jul 15 | X post #OKXAI · Google form · **submitted** |
| Jul 16–17 | Buffer: review feedback, social push |

## 16. Open unknowns — verified Jul 9, each with a designed fallback

| # | Unknown | Fallback |
|---|---|---|
| 1 | Does A2MCP support variable per-call pricing? | Fixed-price coverage brackets as three bind tools: *Skiff* ($10 cover), *Frigate* ($25), *Galleon* ($50) |
| 2 | Are dispute verdicts API-readable? | v1 is timeout-parametric only — "delivery protection"; still real, still demos |
| 3 | Will OKX review balk at a "financial" ASP? | Frame as *delivery protection* (warranty framing), tiny caps, full transparency page |

## 17. Known risks (accepted for hackathon scale)

Fraud rings (mitigated §11, residual accepted) · correlated failures (mitigated §9 exposure caps) · adverse selection/moral hazard (80% co-insurance, risk-scaled premiums) · capital adequacy (solvency ratio, $50 caps) · platform dependency (accepted — being the reference implementation on OKX rails is the point) · dispute-verdict latency (timeout trigger is the primary path) · regulation (hackathon scale, protection-product framing; flagged for any real business later).
