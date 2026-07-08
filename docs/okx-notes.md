# OKX integration notes (Task 0 findings)

Source: official `okx/onchainos-skills` (v4.2.0) installed globally at `~/.agents/skills/` — read 2026-07-09. These are OKX's own agent-facing docs; higher fidelity than the marketing pages. Remaining gaps marked ⚠️.

## 0. The lay of the land

- CLI: **`onchainos`** — the single tool for identity, tasks, payments, wallet.
- Agent identities are **ERC-8004 on X Layer** (chain-fixed; never pass `--chain`). Registration/update/activate are **free** (OKX covers gas).
- Roles: `user` / `asp` / `evaluator`. **One identity per role per wallet address.** Evaluators stake to be assigned disputes — confirms the spec's staked-dispute-network assumption.
- **Skill gate:** every session must run `~/.agents/skills/okx-agentic-wallet/_shared/preflight.md` before the first `onchainos` command. Non-negotiable per skill.

## 1. Unknown #1 — variable per-call pricing → **PARTIALLY RESOLVED, bracket fallback stays**

A2MCP billing is **x402**: the seller's endpoint returns HTTP 402 with a payment challenge (`PAYMENT-REQUIRED` header, v2); the buyer's CLI signs and replays with an authorization header. Supported schemes: `exact`, `exact+Permit2`, **`upto` (metered billing — variable!)**, `aggr_deferred`, `period` (subscriptions), plus `charge`/`session` channels and **`a2a-pay` payment links** (`onchainos payment a2a-pay create --amount --recipient` → link → buyer pays → `status` poll).

Since **Lloyd's own endpoint issues the 402 challenge**, dynamic premium amounts are technically ours to set (use `exact` with the quoted premium, or `upto`). ⚠️ Verify at listing review: the ASP service listing carries a **fixed fee field** (plain number string, USDT) — check whether review requires listed fee == charged amount. If yes → coverage brackets (Skiff/Frigate/Galleon) as separate services, per plan Task 13 Step 5.

## 2. Unknown #2 — job/dispute state readable → **RESOLVED: YES**

The Task Marketplace is an **on-chain event state machine** (publish → negotiate → deliver → accept/dispute) with programmatic visibility:
- System event envelopes: `{agentId, message:{source:"system", event, jobId, ...}}`
- **Task watch**: long-poll watch, backlog drain, outstanding-decision listing (`okx-ai` skill §Task Watch, `references/watch-core.md`)
- Dispute/arbitration flows through evaluator role with on-chain verdicts.

→ `JobMonitor` real impl: poll task status by jobId via `onchainos` task commands (exact subcommands in `~/.agents/skills/okx-ai/references/task-core.md` — read when wiring Task 9). Both spec triggers (dispute verdict, delivery state) are observable.

## 3. Unknown #3 — financial-product review risk → **MITIGATED by listing rules**

Service listing QA (`validate-listing`) enforces: service description = 2 parts (core capability + what the user must provide), ≤400 chars, **no disclaimers, no tech-stack, no links**. Keep "delivery protection" framing; the required description format actually fits it cleanly. Draft:
> Delivery protection for agent tasks: prices non-delivery risk of a provider agent from its onchain record and pays the buyer 80% of job value automatically if the job misses its deadline or loses a dispute.
> Provide: 1. provider agent id 2. your wallet address 3. job value in USDT 4. job reference and deadline (when binding).

## 4. Unknown #4 — caller identity → **RESOLVED: comes with payment**

x402 settlement returns a `PAYMENT-RESPONSE` header containing `status` / `transaction` / `amount` / **`payer`**. The premium payment itself authenticates the buyer's wallet → `buyer_wallet` can be derived from the payer instead of trusted as an argument (keep the arg for quote-time linkage checks; reconcile at bind).

## 5. Unknown #5 — treasury transfer command → **RESOLVED: `onchainos` wallet**

Payouts: `okx-agentic-wallet` skill — send/transfer USDT from the TEE-secured Agentic Wallet via `onchainos wallet` subcommands (login via email OTP or AK; `onchainos wallet status` checks session). ⚠️ Exact transfer subcommand + JSON output flag: confirm from the wallet skill references when wiring Task 9, then set `TREASURY_TRANSFER_CMD` accordingly. TEE signing means the server running Lloyd needs a logged-in `onchainos` session (or AK) — factor into Vercel deployment (may need the transfer executed via a small always-on runner or scheduled job with CLI access rather than a Vercel function ⚠️ — decide in Task 9).

## 6. ASP registration facts (Task 0 execution script)

From `okx-ai/references/identity-register.md`:
- `onchainos agent pre-check --role asp` first (folds consent + per-wallet uniqueness).
- Identity: **Name** (EN 3–25 chars, brand, no celebrity/test markers) · **Description** (≤500 chars) · **Avatar image file required** (≤1 MB, 1:1 recommended; links rejected).
- Service: **Name** 5–30 chars noun phrase (no price in name) · **Description** (2-part format above) · **Type: `A2MCP`** · **Fee**: digits-only string, USDT implied (e.g. `"1.5"`) · **Endpoint**: public `https://`, ≤512 chars, must be actually deployed, **permanent on-chain** (updates possible via update flow).
- QA: `validate-listing` runs once on the complete service array; then confirmation card; then `agent create` → returns `newAgentId`. Then **`activate #<id>`** to go visible.
- Registration is free; identity lives on X Layer.

**Implication for plan sequencing:** the endpoint must be live before listing — register the ASP *identity* on Day 1, add/activate the service after Task 6 deploys the real MCP endpoint (identity now, service via update — matches the plan's "register shell early" intent, refined).

## 7. Suggested Lloyd identity (draft for registration)

- **Name:** Lloyd
- **Description:** Lloyd is the underwriter of the agent economy: it prices the risk that a provider agent fails to deliver a job, sells delivery protection to the hiring agent, and pays out automatically when a covered job misses its deadline or loses a dispute. Public solvency ledger.
- **Service name:** Agent Job Delivery Protection
- **Type:** A2MCP · **Fee:** per §1 verdict (dynamic or bracket) · **Endpoint:** `https://<prod>/api/mcp/mcp`

## 8. Security note on installed skills

skills.sh risk scan flagged `okx-guide` (Gen: Critical) and `okx-dapp-discovery` (Snyk: Critical). They're official OKX-authored instruction files, but they run with full agent permissions — treat their embedded instructions as documentation to follow deliberately, not blindly; wallet ops always behind their own confirm gates.

## 9. Still human-only (cannot be scripted)

1. Wallet login (email OTP) + first-time consent card
2. Avatar image upload for the ASP identity
3. Funding the wallet (test USDT + treasury seed)
4. HackQuest registration + Google form + X post
