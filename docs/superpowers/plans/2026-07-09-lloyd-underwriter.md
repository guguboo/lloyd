# Lloyd Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Lloyd — a per-job micro-insurance ASP live on OKX.AI — with quote/bind/settle lifecycle, public Ledger, demo agents, and hackathon submission by July 15, 2026.

**Architecture:** Single Next.js (App Router, TypeScript) deployable on Vercel exposing an MCP endpoint (the ASP surface), a public Ledger dashboard, and a cron-driven settlement watcher. Supabase Postgres persists quotes/policies/claims/ledger. All OKX integration (reputation data, job state, payouts) sits behind three adapter interfaces with data-driven fixture implementations, so the core works end-to-end before any OKX unknown is resolved.

**Tech Stack:** Next.js 15 (App Router) · TypeScript · `mcp-handler` + `@modelcontextprotocol/sdk` + `zod` · Supabase (`@supabase/supabase-js`) · Vitest · Vercel (hosting + cron) · OKX Onchain OS (Agentic Wallet, Open API).

## Global Constraints

Copied verbatim from spec (`docs/superpowers/specs/2026-07-09-lloyd-underwriter-design.md`):

- Payout ratio: **80% co-insurance**; per-policy coverage cap **$50**; newcomer cap **$10** (class C forced).
- Premium rates: **A: 3%, B: 7%, C: 15%; floor $0.50**.
- Solvency: total outstanding coverage ≤ **50% of pool**; per-provider exposure ≤ **10% of pool**; max **2 paid claims per buyer wallet per rolling 7 days**; one active policy per buyer–provider pair.
- Any underwriting data-source timeout → **Decline, never guess**.
- **No LLM in any money path** — pricing and settlement are pure deterministic functions.
- Kill-switch env flag stops *new* policies; existing policies always honored.
- A policy **pays at most once — enforced by DB constraint**, not application logic.
- Settlement trigger priority: dispute verdict against provider, then delivery timeout.
- Every treasury movement: DB row + onchain tx hash, publicly visible on the Ledger.
- Calendar: submission assets done **July 15**; July 16–17 are buffer only.
- All amounts are USDT with 2-decimal rounding (`round2`).

**Deliberate deviation from spec §6** (spec self-consistency fix): `bind_policy` takes `(quote_id, job_ref, deadline_at)` — spec §8 requires each policy to attach to a specific job reference with an explicit delivery deadline, so bind must receive them. `get_quote` additionally takes `buyer_wallet` (payout destination + linkage check input) because A2MCP caller identity is not guaranteed to be readable (unknown #4, resolved in Task 0).

---

## File structure (locked before tasks)

```
lloyd/
├── app/
│   ├── api/mcp/[transport]/route.ts   # MCP endpoint — the ASP surface (4 tools, thin handlers)
│   ├── api/watcher/route.ts           # Cron-secured settlement trigger
│   ├── page.tsx                       # Lloyd's Ledger (public dashboard)
│   └── about/page.tsx                 # Landing / listing copy
├── lib/
│   ├── db.ts                          # Supabase admin client (server-only)
│   ├── store.ts                       # All DB reads/writes (quotes, policies, claims, ledger, stats)
│   ├── underwrite/
│   │   ├── types.ts                   # ProviderRecord, QuoteDecision, RiskClass, DeclineReason
│   │   └── engine.ts                  # evaluateQuote() — pure pricing brain
│   ├── treasury/
│   │   └── solvency.ts                # canBind() — pure solvency/fraud gate
│   ├── settlement/
│   │   ├── decide.ts                  # decideSettlement() — pure trigger logic
│   │   └── run.ts                     # runSettlement() — executor (claims, payouts, retries)
│   └── okx/
│       ├── types.ts                   # ReputationSource, JobMonitor, Treasury interfaces
│       ├── fixtures.ts                # Db-backed fixture impls (dossiers, demo_jobs, logged payouts)
│       ├── real.ts                    # Env-templated real impls (Task 9, shaped by Task 0 findings)
│       └── index.ts                   # Factory: picks impl per env (LLOYD_MODE=fixture|real)
├── tests/
│   ├── engine.test.ts
│   ├── solvency.test.ts
│   └── settlement.test.ts
├── scripts/
│   ├── seed.ts                        # Seed pool + dossiers + demo agents
│   └── rehearsal.ts                   # Marlowe & Pepys end-to-end lifecycle
├── supabase/migrations/001_init.sql
├── docs/okx-notes.md                  # Task 0 findings (verified commands/APIs)
├── vercel.json                        # Cron config
└── .env.local                         # Secrets (never committed)
```

Responsibility boundaries: routes are thin (parse → call lib → respond); all money logic is pure functions in `lib/underwrite`, `lib/treasury`, `lib/settlement/decide.ts`; all DB access concentrates in `lib/store.ts`; all OKX contact concentrates in `lib/okx/`.

---

### Task 0: OKX onboarding + unknown verification (manual, do first — human gate)

**Files:**
- Create: `docs/okx-notes.md`

**Interfaces:**
- Produces: verified answers to unknowns #1–#4 recorded in `docs/okx-notes.md`; a funded Agentic Wallet; an ASP registration in OKX review. Task 9 and Task 13 consume this file.

- [ ] **Step 1: Register on HackQuest** — enroll at https://www.hackquest.io/hackathons/OKXAI-Genesis-Hackathon with the account you'll submit under.

- [ ] **Step 2: Set up OKX Agentic Wallet** — follow https://www.okx.ai/tutorial : create the Agentic Wallet (TEE-managed keys), install the Onchain OS skill, fund it with ~50 USDT for testing (treasury seed of 200–500 USDT can wait until Task 13). Record the wallet address in `docs/okx-notes.md`.

- [ ] **Step 3: Start ASP registration immediately** — register Lloyd as an ASP in **A2MCP (pay-per-call)** mode. Service description (use verbatim, aligns with unknown #3 fallback):
  > **Lloyd — delivery protection for agent work.** Before you hire an agent, Lloyd prices the risk of non-delivery from its onchain record and sells you a policy. If the job isn't delivered by the deadline (or a dispute is ruled against the provider), Lloyd automatically pays you 80% of the job value in USDT. Transparent solvency at [Ledger URL]. Tools: get_quote, bind_policy, get_policy, file_claim.

  Per `docs/okx-notes.md` §6: register the **ASP identity** (name/description/avatar) on Day 1 via `onchainos agent create --role asp` — but the *service* listing requires a really-deployed `https://` endpoint (listing QA rejects placeholders), so add + activate the service via the update flow as soon as Task 6's MCP endpoint is deployed (target Jul 11–12). Identity registration is free and instant; the service review is the human gate — submit it the moment the endpoint is live.

- [ ] **Step 4: Verify the unknowns** — ✅ **largely pre-resolved 2026-07-09** by reading the official `okx/onchainos-skills` (installed at `~/.agents/skills/`); findings recorded in `docs/okx-notes.md`: #2 job/dispute state = YES (task-watch event state machine), #4 caller identity = YES (x402 `PAYMENT-RESPONSE.payer`), #5 treasury = `onchainos wallet` transfer (exact subcommand at Task 9), #1 = partially (x402 `upto`/dynamic challenge — confirm listing review accepts it), #3 = mitigated (2-part listing description fits "delivery protection"). Remaining ⚠️ items to close during onboarding, each with the exact API/command or "NOT AVAILABLE":
  1. Can an A2MCP tool call be **variably priced** per call? If not → coverage brackets (Task 9 fallback note).
  2. Are **dispute verdicts / escrow states readable** via API for arbitrary jobs? Exact endpoint + response shape, or NOT AVAILABLE → timeout-parametric only.
  3. Any ASP review policy against **financial/insurance products**? If concern → keep "delivery protection" framing everywhere.
  4. Does the A2MCP call context expose the **caller's wallet identity**? If yes, note where; if no, `buyer_wallet` stays an explicit tool argument.
  5. The exact **USDT transfer command/API** available to our wallet (CLI command or HTTP endpoint, with auth). This becomes `TREASURY_TRANSFER_CMD` in Task 9.

- [ ] **Step 5: Claim identity** — X handle (e.g. @LloydUnderwrites) and domain if desired. Record handles in `docs/okx-notes.md`.

- [ ] **Step 6: Commit**

```bash
git add docs/okx-notes.md
git commit -m "docs: OKX onboarding findings and verified integration surface"
```

---

### Task 1: Project scaffold

**Files:**
- Create: Next.js app in repo root (create-next-app), `vitest.config.ts`, `.env.local`, `.gitignore` additions, `lib/db.ts`

**Interfaces:**
- Produces: `supabaseAdmin: SupabaseClient` from `lib/db.ts`; `npx vitest run` as the test command; a deployed placeholder URL on Vercel.

- [ ] **Step 1: Scaffold Next.js into the existing repo**

```bash
cd /Users/vics/Development/Hackathon/okx-hackathon
npx create-next-app@latest . --ts --app --no-tailwind --eslint --no-src-dir --import-alias "@/*" --use-npm
npm i @supabase/supabase-js zod mcp-handler @modelcontextprotocol/sdk
npm i -D vitest tsx
```

Expected: scaffold completes; `npm run dev` serves the default page on :3000.

- [ ] **Step 2: Add Vitest config**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname) } },
});
```

- [ ] **Step 3: Add test script to package.json** — in `"scripts"` add `"test": "vitest run"`.

- [ ] **Step 4: Create Supabase admin client**

```ts
// lib/db.ts
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
```

- [ ] **Step 5: Create `.env.local` and gitignore it** (values filled in Task 3/9)

```bash
cat >> .gitignore <<'EOF'
.env.local
EOF
cat > .env.local <<'EOF'
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=change-me
LLOYD_MODE=fixture
KILL_SWITCH=false
EOF
```

- [ ] **Step 6: Deploy placeholder to Vercel** (gives Task 0 Step 3 a URL)

```bash
npx vercel link
npx vercel deploy --prod
```

Expected: production URL printed — record it in `docs/okx-notes.md`.

- [ ] **Step 7: Sanity-run tests** — `npm test` → Expected: "no test files found" exit 0 or trivially passing.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + Vitest + Supabase client"
```

---

### Task 2: Pricing engine (pure, golden-tested)

**Files:**
- Create: `lib/underwrite/types.ts`, `lib/underwrite/engine.ts`
- Test: `tests/engine.test.ts`

**Interfaces:**
- Produces: `evaluateQuote(rec: ProviderRecord, jobValueUsdt: number): QuoteDecision`; types `ProviderRecord`, `QuoteDecision`, `RiskClass`, `DeclineReason`; constants `RATES`, `PREMIUM_FLOOR_USDT`, `COVERAGE_RATIO`, `MAX_COVERAGE_USDT`, `NEWCOMER_MAX_COVERAGE_USDT`; helper `round2(n: number): number`. Tasks 5, 9 consume `ProviderRecord`; Task 6 consumes `QuoteDecision`.

- [ ] **Step 1: Write the types**

```ts
// lib/underwrite/types.ts
export type RiskClass = 'A' | 'B' | 'C';

export type DeclineReason =
  | 'linked_wallets'
  | 'high_dispute_rate'
  | 'data_unavailable'
  | 'invalid_job_value';

export interface ProviderRecord {
  providerId: string;
  walletAgeDays: number;
  completedJobs: number;
  totalVolumeUsdt: number;
  disputeRate: number;        // 0..1
  avgRating: number | null;   // 1..5, null if unrated
  linkedToBuyer: boolean;     // computed against the quoting buyer
}

export type QuoteDecision =
  | {
      decision: 'quote';
      riskClass: RiskClass;
      premiumUsdt: number;
      coverageUsdt: number;
      newcomer: boolean;
    }
  | { decision: 'decline'; reason: DeclineReason };
```

- [ ] **Step 2: Write the failing golden tests**

```ts
// tests/engine.test.ts
import { describe, it, expect } from 'vitest';
import { evaluateQuote } from '@/lib/underwrite/engine';
import type { ProviderRecord } from '@/lib/underwrite/types';

const veteran: ProviderRecord = {
  providerId: 'agent-vet', walletAgeDays: 120, completedJobs: 80,
  totalVolumeUsdt: 5000, disputeRate: 0.01, avgRating: 4.8, linkedToBuyer: false,
};

const solid: ProviderRecord = { ...veteran, completedJobs: 20, disputeRate: 0.05 }; // class B
const marlowe: ProviderRecord = {
  providerId: 'marlowe', walletAgeDays: 40, completedJobs: 12,
  totalVolumeUsdt: 300, disputeRate: 0.05, avgRating: 4.0, linkedToBuyer: false,
}; // class B — the demo case

describe('evaluateQuote', () => {
  it('prices a class-A veteran: $20 job → premium 0.60, coverage 16.00', () => {
    const q = evaluateQuote(veteran, 20);
    expect(q).toEqual({ decision: 'quote', riskClass: 'A', premiumUsdt: 0.6, coverageUsdt: 16, newcomer: false });
  });

  it('matches the spec demo number: class B, $20 job → premium 1.40', () => {
    const q = evaluateQuote(marlowe, 20);
    expect(q).toMatchObject({ decision: 'quote', riskClass: 'B', premiumUsdt: 1.4, coverageUsdt: 16 });
  });

  it('applies the $0.50 premium floor (class A, $10 job → 0.30 → 0.50)', () => {
    expect(evaluateQuote(veteran, 10)).toMatchObject({ premiumUsdt: 0.5 });
  });

  it('caps coverage at $50 (class A, $100 job → coverage 50, not 80)', () => {
    expect(evaluateQuote(veteran, 100)).toMatchObject({ coverageUsdt: 50 });
  });

  it('forces newcomers to class C with $10 coverage cap', () => {
    const newbie: ProviderRecord = { ...veteran, completedJobs: 1, walletAgeDays: 2 };
    expect(evaluateQuote(newbie, 40)).toMatchObject({ riskClass: 'C', coverageUsdt: 10, newcomer: true });
  });

  it('declines linked wallets', () => {
    expect(evaluateQuote({ ...veteran, linkedToBuyer: true }, 20))
      .toEqual({ decision: 'decline', reason: 'linked_wallets' });
  });

  it('declines dispute rate > 0.25', () => {
    expect(evaluateQuote({ ...solid, disputeRate: 0.3 }, 20))
      .toEqual({ decision: 'decline', reason: 'high_dispute_rate' });
  });

  it('downgrades one class when dispute rate > 0.10 (A → B)', () => {
    expect(evaluateQuote({ ...veteran, disputeRate: 0.12 }, 20)).toMatchObject({ riskClass: 'B' });
  });

  it('downgrades one class when avgRating < 3.5 (B → C)', () => {
    expect(evaluateQuote({ ...solid, avgRating: 3.0 }, 20)).toMatchObject({ riskClass: 'C' });
  });

  it('declines non-positive job values', () => {
    expect(evaluateQuote(veteran, 0)).toEqual({ decision: 'decline', reason: 'invalid_job_value' });
    expect(evaluateQuote(veteran, -5)).toEqual({ decision: 'decline', reason: 'invalid_job_value' });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `@/lib/underwrite/engine`.

- [ ] **Step 4: Write the engine**

```ts
// lib/underwrite/engine.ts
import type { ProviderRecord, QuoteDecision, RiskClass } from './types';

export const RATES: Record<RiskClass, number> = { A: 0.03, B: 0.07, C: 0.15 };
export const PREMIUM_FLOOR_USDT = 0.5;
export const COVERAGE_RATIO = 0.8;
export const MAX_COVERAGE_USDT = 50;
export const NEWCOMER_MAX_COVERAGE_USDT = 10;

export const round2 = (n: number) => Math.round(n * 100) / 100;

const downgrade = (c: RiskClass): RiskClass => (c === 'A' ? 'B' : 'C');

export function evaluateQuote(rec: ProviderRecord, jobValueUsdt: number): QuoteDecision {
  if (!Number.isFinite(jobValueUsdt) || jobValueUsdt <= 0)
    return { decision: 'decline', reason: 'invalid_job_value' };
  if (rec.linkedToBuyer) return { decision: 'decline', reason: 'linked_wallets' };
  if (rec.disputeRate > 0.25) return { decision: 'decline', reason: 'high_dispute_rate' };

  const newcomer = rec.completedJobs < 3 || rec.walletAgeDays < 7;

  let riskClass: RiskClass;
  if (newcomer) riskClass = 'C';
  else if (rec.completedJobs >= 50 && rec.walletAgeDays >= 30 && rec.disputeRate <= 0.02) riskClass = 'A';
  else riskClass = 'B';

  if (!newcomer && rec.disputeRate > 0.1) riskClass = downgrade(riskClass);
  if (!newcomer && rec.avgRating !== null && rec.avgRating < 3.5) riskClass = downgrade(riskClass);

  const cap = newcomer ? NEWCOMER_MAX_COVERAGE_USDT : MAX_COVERAGE_USDT;

  return {
    decision: 'quote',
    riskClass,
    premiumUsdt: round2(Math.max(jobValueUsdt * RATES[riskClass], PREMIUM_FLOOR_USDT)),
    coverageUsdt: round2(Math.min(COVERAGE_RATIO * jobValueUsdt, cap)),
    newcomer,
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: 10 passing.

- [ ] **Step 6: Commit**

```bash
git add lib/underwrite tests/engine.test.ts
git commit -m "feat: deterministic pricing engine with golden tests"
```

---

### Task 3: Database schema + store layer

**Files:**
- Create: `supabase/migrations/001_init.sql`, `lib/store.ts`

**Interfaces:**
- Consumes: `supabaseAdmin` (Task 1), `QuoteDecision`/`ProviderRecord` types (Task 2).
- Produces (all in `lib/store.ts`, all `async`, all throw on DB error):
  - `getDossier(providerId: string): Promise<ProviderRecord | null>` — `linkedToBuyer` is left `false`; caller overlays it via `isLinked`.
  - `isLinked(providerId: string, buyerWallet: string): Promise<boolean>`
  - `createQuote(q: { providerId; buyerWallet; jobValueUsdt; jobType; riskClass; premiumUsdt; coverageUsdt }): Promise<{ id: string; expiresAt: string }>`
  - `getOpenQuote(quoteId: string): Promise<QuoteRow | null>` (null if missing/expired/bound)
  - `bindQuote(quoteId: string, jobRef: string, deadlineAt: string): Promise<PolicyRow>` — inserts policy (unique quote_id gate), marks quote bound, records premium ledger event
  - `getPolicy(policyId: string): Promise<PolicyRow | null>`
  - `getBindContext(buyerWallet: string, providerId: string): Promise<{ poolUsdt; outstandingUsdt; providerOutstandingUsdt; buyerPaidClaims7d: number; buyerHasActivePolicyWithProvider: boolean }>`
  - `getActivePolicies(): Promise<PolicyRow[]>`; `getPendingClaims(): Promise<ClaimRow[]>`
  - `openClaim(policyId: string, trigger: 'dispute_verdict'|'delivery_timeout'|'manual', amountUsdt: number): Promise<ClaimRow | null>` (null if claim already exists — pays-once)
  - `markClaimPaid(claimId: string, txHash: string): Promise<void>`; `markPolicy(policyId: string, status: PolicyStatus): Promise<void>`
  - `getLedgerStats(): Promise<{ poolUsdt; outstandingUsdt; policiesWritten: number; claimsPaid: number }>`; `recentActivity(): Promise<{ policies: PolicyRow[]; claims: ClaimRow[] }>`
  - Row types: `QuoteRow`, `PolicyRow`, `ClaimRow`, `PolicyStatus = 'active'|'expired'|'claim_pending'|'paid_out'`

- [ ] **Step 1: Create Supabase project** — via dashboard (or `supabase` MCP tool): new project `lloyd`. Put `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` into `.env.local`.

- [ ] **Step 2: Write the migration**

```sql
-- supabase/migrations/001_init.sql
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
  premium_usdt numeric not null,
  coverage_usdt numeric not null,
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
```

- [ ] **Step 3: Apply the migration** — Supabase SQL editor (paste + run) or `supabase` MCP `apply_migration`.
Expected: all 6 tables exist (`select count(*) from policies;` → 0).

- [ ] **Step 4: Write the store**

```ts
// lib/store.ts
import { supabaseAdmin as db } from './db';
import type { ProviderRecord, RiskClass } from './underwrite/types';

export type PolicyStatus = 'active' | 'expired' | 'claim_pending' | 'paid_out';

export interface QuoteRow {
  id: string; provider_id: string; buyer_wallet: string; job_value_usdt: number;
  job_type: string; risk_class: RiskClass; premium_usdt: number; coverage_usdt: number;
  status: 'open' | 'bound'; expires_at: string;
}
export interface PolicyRow {
  id: string; quote_id: string; provider_id: string; buyer_wallet: string;
  job_ref: string; job_value_usdt: number; coverage_usdt: number; premium_usdt: number;
  deadline_at: string; status: PolicyStatus; created_at: string;
}
export interface ClaimRow {
  id: string; policy_id: string; trigger: 'dispute_verdict' | 'delivery_timeout' | 'manual';
  amount_usdt: number; status: 'pending' | 'paid'; tx_hash: string | null; created_at: string;
}

const num = (v: unknown) => Number(v); // supabase returns numeric as string

export async function getDossier(providerId: string): Promise<ProviderRecord | null> {
  const { data, error } = await db.from('provider_dossiers').select('*').eq('provider_id', providerId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    providerId: data.provider_id,
    walletAgeDays: data.wallet_age_days,
    completedJobs: data.completed_jobs,
    totalVolumeUsdt: num(data.total_volume_usdt),
    disputeRate: num(data.dispute_rate),
    avgRating: data.avg_rating === null ? null : num(data.avg_rating),
    linkedToBuyer: false,
  };
}

export async function isLinked(providerId: string, buyerWallet: string): Promise<boolean> {
  const { data, error } = await db.from('provider_dossiers')
    .select('linked_wallets').eq('provider_id', providerId).maybeSingle();
  if (error) throw error;
  return !!data?.linked_wallets?.includes(buyerWallet);
}

export async function createQuote(q: {
  providerId: string; buyerWallet: string; jobValueUsdt: number; jobType: string;
  riskClass: RiskClass; premiumUsdt: number; coverageUsdt: number;
}): Promise<{ id: string; expiresAt: string }> {
  const { data, error } = await db.from('quotes').insert({
    provider_id: q.providerId, buyer_wallet: q.buyerWallet, job_value_usdt: q.jobValueUsdt,
    job_type: q.jobType, risk_class: q.riskClass, premium_usdt: q.premiumUsdt, coverage_usdt: q.coverageUsdt,
  }).select('id, expires_at').single();
  if (error) throw error;
  return { id: data.id, expiresAt: data.expires_at };
}

export async function getOpenQuote(quoteId: string): Promise<QuoteRow | null> {
  const { data, error } = await db.from('quotes').select('*')
    .eq('id', quoteId).eq('status', 'open').gt('expires_at', new Date().toISOString()).maybeSingle();
  if (error) throw error;
  return data as QuoteRow | null;
}

export async function bindQuote(quoteId: string, jobRef: string, deadlineAt: string): Promise<PolicyRow> {
  const quote = await getOpenQuote(quoteId);
  if (!quote) throw new Error('quote_not_open');
  // Unique(quote_id) on policies is the atomic single-use gate.
  const { data: policy, error } = await db.from('policies').insert({
    quote_id: quote.id, provider_id: quote.provider_id, buyer_wallet: quote.buyer_wallet,
    job_ref: jobRef, job_value_usdt: quote.job_value_usdt, coverage_usdt: quote.coverage_usdt,
    premium_usdt: quote.premium_usdt, deadline_at: deadlineAt,
  }).select('*').single();
  if (error) throw error;
  await db.from('quotes').update({ status: 'bound' }).eq('id', quote.id);
  const { error: ledgerErr } = await db.from('ledger_events').insert({
    kind: 'premium', amount_usdt: quote.premium_usdt, policy_id: policy.id,
    note: `premium for policy ${policy.id}`,
  });
  if (ledgerErr) throw ledgerErr;
  return policy as PolicyRow;
}

export async function getPolicy(policyId: string): Promise<PolicyRow | null> {
  const { data, error } = await db.from('policies').select('*').eq('id', policyId).maybeSingle();
  if (error) throw error;
  return data as PolicyRow | null;
}

export async function getBindContext(buyerWallet: string, providerId: string) {
  const [{ data: ledger }, { data: active }, { data: claims }] = await Promise.all([
    db.from('ledger_events').select('amount_usdt'),
    db.from('policies').select('provider_id, buyer_wallet, coverage_usdt').in('status', ['active', 'claim_pending']),
    db.from('claims').select('id, status, paid_at, policies!inner(buyer_wallet)')
      .eq('status', 'paid').eq('policies.buyer_wallet', buyerWallet)
      .gte('paid_at', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()),
  ]);
  const poolUsdt = (ledger ?? []).reduce((s, r) => s + num(r.amount_usdt), 0);
  const rows = active ?? [];
  return {
    poolUsdt,
    outstandingUsdt: rows.reduce((s, r) => s + num(r.coverage_usdt), 0),
    providerOutstandingUsdt: rows.filter(r => r.provider_id === providerId)
      .reduce((s, r) => s + num(r.coverage_usdt), 0),
    buyerPaidClaims7d: (claims ?? []).length,
    buyerHasActivePolicyWithProvider: rows.some(r => r.buyer_wallet === buyerWallet && r.provider_id === providerId),
  };
}

export async function getActivePolicies(): Promise<PolicyRow[]> {
  const { data, error } = await db.from('policies').select('*').eq('status', 'active');
  if (error) throw error;
  return (data ?? []) as PolicyRow[];
}

export async function getPendingClaims(): Promise<ClaimRow[]> {
  const { data, error } = await db.from('claims').select('*').eq('status', 'pending');
  if (error) throw error;
  return (data ?? []) as ClaimRow[];
}

export async function openClaim(
  policyId: string, trigger: ClaimRow['trigger'], amountUsdt: number,
): Promise<ClaimRow | null> {
  const { data, error } = await db.from('claims')
    .insert({ policy_id: policyId, trigger, amount_usdt: amountUsdt }).select('*').single();
  if (error) {
    if (error.code === '23505') return null; // unique_violation → already claimed: pays-once
    throw error;
  }
  return data as ClaimRow;
}

export async function markClaimPaid(claimId: string, txHash: string): Promise<void> {
  const { data: claim, error } = await db.from('claims')
    .update({ status: 'paid', tx_hash: txHash, paid_at: new Date().toISOString() })
    .eq('id', claimId).select('policy_id, amount_usdt').single();
  if (error) throw error;
  const { error: e2 } = await db.from('ledger_events').insert({
    kind: 'payout', amount_usdt: -num(claim.amount_usdt), policy_id: claim.policy_id, tx_hash: txHash,
  });
  if (e2) throw e2;
}

export async function markPolicy(policyId: string, status: PolicyStatus): Promise<void> {
  const { error } = await db.from('policies').update({ status }).eq('id', policyId);
  if (error) throw error;
}

export async function getLedgerStats() {
  const [{ data: ledger }, { count: written }, { count: paid }] = await Promise.all([
    db.from('ledger_events').select('amount_usdt, kind'),
    db.from('policies').select('id', { count: 'exact', head: true }),
    db.from('claims').select('id', { count: 'exact', head: true }).eq('status', 'paid'),
  ]);
  const rows = ledger ?? [];
  const { data: active } = await db.from('policies')
    .select('coverage_usdt').in('status', ['active', 'claim_pending']);
  return {
    poolUsdt: rows.reduce((s, r) => s + num(r.amount_usdt), 0),
    outstandingUsdt: (active ?? []).reduce((s, r) => s + num(r.coverage_usdt), 0),
    policiesWritten: written ?? 0,
    claimsPaid: paid ?? 0,
  };
}

export async function recentActivity() {
  const [{ data: policies }, { data: claims }] = await Promise.all([
    db.from('policies').select('*').order('created_at', { ascending: false }).limit(20),
    db.from('claims').select('*').order('created_at', { ascending: false }).limit(20),
  ]);
  return { policies: (policies ?? []) as PolicyRow[], claims: (claims ?? []) as ClaimRow[] };
}
```

- [ ] **Step 5: Smoke-verify against the live DB**

```bash
npx tsx --env-file=.env.local -e "
import('./lib/store').then(async (s) => {
  console.log(await s.getLedgerStats());
});"
```

Expected: `{ poolUsdt: 0, outstandingUsdt: 0, policiesWritten: 0, claimsPaid: 0 }`.

- [ ] **Step 6: Commit**

```bash
git add supabase lib/store.ts
git commit -m "feat: schema + store layer (pays-once and single-use quotes enforced in DB)"
```

---

### Task 4: Solvency gate (pure, tested)

**Files:**
- Create: `lib/treasury/solvency.ts`
- Test: `tests/solvency.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces: `canBind(ctx: BindContext): BindCheck` with `BindContext = { poolUsdt; outstandingUsdt; providerOutstandingUsdt; newCoverageUsdt; buyerPaidClaims7d; buyerHasActivePolicyWithProvider; killSwitch: boolean }` and `BindCheck = { ok: true } | { ok: false; reason: string }`. Task 6 consumes both; Task 3's `getBindContext` supplies all fields except `newCoverageUsdt`/`killSwitch`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/solvency.test.ts
import { describe, it, expect } from 'vitest';
import { canBind, type BindContext } from '@/lib/treasury/solvency';

const base: BindContext = {
  poolUsdt: 300, outstandingUsdt: 100, providerOutstandingUsdt: 10,
  newCoverageUsdt: 16, buyerPaidClaims7d: 0,
  buyerHasActivePolicyWithProvider: false, killSwitch: false,
};

describe('canBind', () => {
  it('accepts a healthy bind', () => expect(canBind(base)).toEqual({ ok: true }));
  it('refuses when kill switch is on', () =>
    expect(canBind({ ...base, killSwitch: true })).toEqual({ ok: false, reason: 'kill_switch_active' }));
  it('refuses a second active policy for the same pair', () =>
    expect(canBind({ ...base, buyerHasActivePolicyWithProvider: true }))
      .toEqual({ ok: false, reason: 'active_policy_exists_for_pair' }));
  it('refuses at 2 paid claims in 7 days', () =>
    expect(canBind({ ...base, buyerPaidClaims7d: 2 })).toEqual({ ok: false, reason: 'claim_velocity_limit' }));
  it('refuses when pool utilization would exceed 50% (135+16 > 150)', () =>
    expect(canBind({ ...base, outstandingUsdt: 135 })).toEqual({ ok: false, reason: 'pool_utilization_cap' }));
  it('refuses when provider share would exceed 10% (20+16 > 30)', () =>
    expect(canBind({ ...base, providerOutstandingUsdt: 20 })).toEqual({ ok: false, reason: 'provider_exposure_cap' }));
  it('boundary: exactly 50% utilization is allowed (134+16 = 150)', () =>
    expect(canBind({ ...base, outstandingUsdt: 134 })).toEqual({ ok: true }));
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// lib/treasury/solvency.ts
export const MAX_POOL_UTILIZATION = 0.5;
export const MAX_PROVIDER_SHARE = 0.1;
export const MAX_PAID_CLAIMS_7D = 2;

export interface BindContext {
  poolUsdt: number;
  outstandingUsdt: number;
  providerOutstandingUsdt: number;
  newCoverageUsdt: number;
  buyerPaidClaims7d: number;
  buyerHasActivePolicyWithProvider: boolean;
  killSwitch: boolean;
}
export type BindCheck = { ok: true } | { ok: false; reason: string };

const no = (reason: string): BindCheck => ({ ok: false, reason });

export function canBind(ctx: BindContext): BindCheck {
  if (ctx.killSwitch) return no('kill_switch_active');
  if (ctx.buyerHasActivePolicyWithProvider) return no('active_policy_exists_for_pair');
  if (ctx.buyerPaidClaims7d >= MAX_PAID_CLAIMS_7D) return no('claim_velocity_limit');
  if (ctx.outstandingUsdt + ctx.newCoverageUsdt > MAX_POOL_UTILIZATION * ctx.poolUsdt)
    return no('pool_utilization_cap');
  if (ctx.providerOutstandingUsdt + ctx.newCoverageUsdt > MAX_PROVIDER_SHARE * ctx.poolUsdt)
    return no('provider_exposure_cap');
  return { ok: true };
}
```

- [ ] **Step 4: Run tests** — `npm test` → all passing (engine + solvency).

- [ ] **Step 5: Commit**

```bash
git add lib/treasury tests/solvency.test.ts
git commit -m "feat: solvency gate — utilization, exposure, velocity, pair, kill-switch"
```

---

### Task 5: OKX adapter interfaces + fixture implementations

**Files:**
- Create: `lib/okx/types.ts`, `lib/okx/fixtures.ts`, `lib/okx/index.ts`

**Interfaces:**
- Consumes: `ProviderRecord` (Task 2), store functions `getDossier`, `isLinked` (Task 3), `supabaseAdmin` (Task 1).
- Produces:
  - `ReputationSource { getProviderRecord(providerId: string, buyerWallet: string): Promise<ProviderRecord | null> }`
  - `JobState = 'pending' | 'delivered' | 'provider_fault'`
  - `JobMonitor { getJobState(jobRef: string): Promise<JobState> }`
  - `Treasury { sendUsdt(toWallet: string, amountUsdt: number, note: string): Promise<{ txHash: string }> }`
  - Factories `getReputationSource()`, `getJobMonitor()`, `getTreasury()` switching on `LLOYD_MODE` (`fixture` now; `real` added in Task 9).
  Tasks 6, 8, 9, 12 consume these.

- [ ] **Step 1: Write the interfaces**

```ts
// lib/okx/types.ts
import type { ProviderRecord } from '../underwrite/types';

export interface ReputationSource {
  getProviderRecord(providerId: string, buyerWallet: string): Promise<ProviderRecord | null>;
}

export type JobState = 'pending' | 'delivered' | 'provider_fault';

export interface JobMonitor {
  getJobState(jobRef: string): Promise<JobState>;
}

export interface Treasury {
  sendUsdt(toWallet: string, amountUsdt: number, note: string): Promise<{ txHash: string }>;
}
```

- [ ] **Step 2: Write the fixtures (data-driven via Supabase — no hardcoded agents)**

```ts
// lib/okx/fixtures.ts
import { supabaseAdmin as db } from '../db';
import { getDossier, isLinked } from '../store';
import type { JobMonitor, JobState, ReputationSource, Treasury } from './types';

export const dbReputationSource: ReputationSource = {
  async getProviderRecord(providerId, buyerWallet) {
    const rec = await getDossier(providerId);
    if (!rec) return null;
    return { ...rec, linkedToBuyer: await isLinked(providerId, buyerWallet) };
  },
};

export const dbJobMonitor: JobMonitor = {
  async getJobState(jobRef): Promise<JobState> {
    const { data, error } = await db.from('demo_jobs').select('state').eq('job_ref', jobRef).maybeSingle();
    if (error) throw error;
    return (data?.state as JobState) ?? 'pending';
  },
};

// ponytail: logs payouts to the ledger with a fake hash; real transfers arrive in Task 9
export const loggingTreasury: Treasury = {
  async sendUsdt(toWallet, amountUsdt, note) {
    const txHash = `fixture-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[treasury:fixture] send ${amountUsdt} USDT → ${toWallet} (${note}) tx=${txHash}`);
    return { txHash };
  },
};
```

- [ ] **Step 3: Write the factory**

```ts
// lib/okx/index.ts
import { dbJobMonitor, dbReputationSource, loggingTreasury } from './fixtures';
import type { JobMonitor, ReputationSource, Treasury } from './types';

const mode = () => process.env.LLOYD_MODE ?? 'fixture';

export function getReputationSource(): ReputationSource {
  return dbReputationSource; // real reputation feed lands in Task 9 if unknown #2/#4 allow
}
export function getJobMonitor(): JobMonitor {
  if (mode() === 'real') throw new Error('real JobMonitor not wired yet — Task 9');
  return dbJobMonitor;
}
export function getTreasury(): Treasury {
  if (mode() === 'real') throw new Error('real Treasury not wired yet — Task 9');
  return loggingTreasury;
}
```

- [ ] **Step 4: Typecheck** — Run: `npx tsc --noEmit` → Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add lib/okx
git commit -m "feat: OKX adapter interfaces with db-backed fixtures"
```

---

### Task 6: MCP endpoint — all four tools

**Files:**
- Create: `app/api/mcp/[transport]/route.ts`

**Interfaces:**
- Consumes: `evaluateQuote` (Task 2), `canBind` (Task 4), store (Task 3), adapters (Task 5).
- Produces: live MCP tools `get_quote`, `bind_policy`, `get_policy`, `file_claim` at `POST /api/mcp/mcp` (streamable HTTP). Tool results are JSON strings in `content[0].text`. Tasks 12, 13 consume the endpoint.

- [ ] **Step 1: Write the route**

```ts
// app/api/mcp/[transport]/route.ts
import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { evaluateQuote } from '@/lib/underwrite/engine';
import { canBind } from '@/lib/treasury/solvency';
import { getReputationSource } from '@/lib/okx';
import {
  bindQuote, createQuote, getBindContext, getOpenQuote, getPolicy, markPolicy, openClaim,
} from '@/lib/store';

const json = (v: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(v) }] });

const handler = createMcpHandler((server) => {
  server.tool(
    'get_quote',
    'Price delivery protection for hiring a provider agent. Returns premium, coverage, and a 1-hour quote_id — or a decline with reason.',
    {
      provider_id: z.string().describe('OKX.AI agent id of the provider you intend to hire'),
      buyer_wallet: z.string().describe('Your wallet address — payout destination if a claim pays'),
      job_value_usdt: z.number().positive().describe('Agreed job value in USDT'),
      job_type: z.string().default('general').describe('Free-text job category'),
    },
    async ({ provider_id, buyer_wallet, job_value_usdt, job_type }) => {
      let record;
      try {
        record = await getReputationSource().getProviderRecord(provider_id, buyer_wallet);
      } catch {
        return json({ decision: 'decline', reason: 'data_unavailable' }); // decline, never guess
      }
      if (!record) return json({ decision: 'decline', reason: 'data_unavailable' });

      const decision = evaluateQuote(record, job_value_usdt);
      if (decision.decision === 'decline') return json(decision);

      const quote = await createQuote({
        providerId: provider_id, buyerWallet: buyer_wallet, jobValueUsdt: job_value_usdt,
        jobType: job_type, riskClass: decision.riskClass,
        premiumUsdt: decision.premiumUsdt, coverageUsdt: decision.coverageUsdt,
      });
      return json({
        decision: 'quote', quote_id: quote.id, expires_at: quote.expiresAt,
        risk_class: decision.riskClass, premium_usdt: decision.premiumUsdt,
        coverage_usdt: decision.coverageUsdt, coverage_ratio: 0.8,
        terms: 'Pays 80% of job value (up to coverage) if the job is not delivered by deadline_at or a dispute is ruled against the provider.',
      });
    },
  );

  server.tool(
    'bind_policy',
    'Bind a quoted policy to a specific job. This is the paid call — the premium is the call price.',
    {
      quote_id: z.string().uuid(),
      job_ref: z.string().describe('The OKX.AI job/escrow reference this policy covers'),
      deadline_at: z.string().datetime().describe('ISO-8601 delivery deadline; max 7 days from now'),
    },
    async ({ quote_id, job_ref, deadline_at }) => {
      const quote = await getOpenQuote(quote_id);
      if (!quote) return json({ ok: false, error: 'quote_not_open_or_expired' });

      const deadline = new Date(deadline_at);
      const maxDeadline = Date.now() + 7 * 24 * 3600 * 1000;
      if (deadline.getTime() <= Date.now() || deadline.getTime() > maxDeadline)
        return json({ ok: false, error: 'deadline_must_be_future_within_7_days' });

      const ctx = await getBindContext(quote.buyer_wallet, quote.provider_id);
      const check = canBind({
        ...ctx,
        newCoverageUsdt: Number(quote.coverage_usdt),
        killSwitch: process.env.KILL_SWITCH === 'true',
      });
      if (!check.ok) return json({ ok: false, error: check.reason });

      try {
        const policy = await bindQuote(quote_id, job_ref, deadline.toISOString());
        return json({
          ok: true, policy_id: policy.id, coverage_usdt: Number(policy.coverage_usdt),
          premium_usdt: Number(policy.premium_usdt), deadline_at: policy.deadline_at,
          certificate: `Lloyd policy ${policy.id}: covers ${policy.coverage_usdt} USDT on job ${job_ref} for ${policy.buyer_wallet} until ${policy.deadline_at}.`,
        });
      } catch (e: unknown) {
        return json({ ok: false, error: e instanceof Error ? e.message : 'bind_failed' });
      }
    },
  );

  server.tool(
    'get_policy',
    'Check the status of a Lloyd policy.',
    { policy_id: z.string().uuid() },
    async ({ policy_id }) => {
      const p = await getPolicy(policy_id);
      if (!p) return json({ ok: false, error: 'not_found' });
      return json({
        ok: true, policy_id: p.id, status: p.status, provider_id: p.provider_id,
        coverage_usdt: Number(p.coverage_usdt), deadline_at: p.deadline_at, job_ref: p.job_ref,
      });
    },
  );

  server.tool(
    'file_claim',
    'Manually file a claim on an active policy (normally settlement is automatic).',
    { policy_id: z.string().uuid() },
    async ({ policy_id }) => {
      const p = await getPolicy(policy_id);
      if (!p) return json({ ok: false, error: 'not_found' });
      if (p.status !== 'active') return json({ ok: false, error: `policy_${p.status}` });
      const claim = await openClaim(p.id, 'manual', Number(p.coverage_usdt));
      if (!claim) return json({ ok: false, error: 'claim_already_exists' });
      await markPolicy(p.id, 'claim_pending');
      return json({ ok: true, claim_id: claim.id, status: 'pending_review', note: 'Manual claims are verified against job state before payout by the settlement run.' });
    },
  );
});

export { handler as GET, handler as POST, handler as DELETE };
```

- [ ] **Step 2: Seed one dossier for manual verification**

Supabase SQL editor:

```sql
insert into provider_dossiers (provider_id, wallet_age_days, completed_jobs, total_volume_usdt, dispute_rate, avg_rating)
values ('marlowe', 40, 12, 300, 0.05, 4.0);
```

- [ ] **Step 3: Verify with MCP Inspector**

```bash
npm run dev &
npx @modelcontextprotocol/inspector http://localhost:3000/api/mcp/mcp
```

In the inspector: list tools (expect 4), call `get_quote` with `{provider_id: "marlowe", buyer_wallet: "0xPEPYS", job_value_usdt: 20, job_type: "research"}`.
Expected: `decision: "quote"`, `risk_class: "B"`, `premium_usdt: 1.4`, `coverage_usdt: 16`.

- [ ] **Step 4: Verify decline path** — call `get_quote` with `provider_id: "nobody"` → Expected: `{"decision":"decline","reason":"data_unavailable"}`.

- [ ] **Step 5: Verify bind + solvency refusal** — call `bind_policy` on the fresh quote with `job_ref: "job-test-1"`, `deadline_at` = tomorrow → Expected: `ok: false, error: "pool_utilization_cap"` (pool is 0 — correct refusal!). This proves the solvency gate is live before money exists.

- [ ] **Step 6: Commit**

```bash
git add app/api/mcp
git commit -m "feat: MCP endpoint with quote/bind/status/claim tools"
```

---

### Task 7: Seed script (pool + demo agents)

**Files:**
- Create: `scripts/seed.ts`

**Interfaces:**
- Consumes: `supabaseAdmin` (Task 1).
- Produces: idempotent seeding — ledger `seed` event (default 300 USDT, env-overridable `SEED_POOL_USDT`), dossiers for `marlowe` (class B) and `fletcher` (class A veteran), a linked-wallet fraud case `mallory`, and `demo_jobs` rows. Tasks 8, 12 rely on these exact ids.

- [ ] **Step 1: Write the seed script**

```ts
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
```

- [ ] **Step 2: Run it**

Run: `npx tsx --env-file=.env.local scripts/seed.ts`
Expected: `seeded pool with 300 USDT` then `seed complete`. Re-run → `pool already seeded, skipping` (idempotent).

- [ ] **Step 3: Re-verify bind now succeeds** — repeat Task 6 Step 5 (fresh quote first: quotes are single-use).
Expected: `ok: true` with a `policy_id` and certificate text.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed.ts
git commit -m "feat: idempotent seed — capital pool, demo dossiers, fraud fixture"
```

---

### Task 8: Settlement — decision (pure, tested) + executor + watcher route

**Files:**
- Create: `lib/settlement/decide.ts`, `lib/settlement/run.ts`, `app/api/watcher/route.ts`, `vercel.json`
- Test: `tests/settlement.test.ts`

**Interfaces:**
- Consumes: `JobMonitor`, `JobState`, `Treasury` (Task 5); store functions (Task 3).
- Produces: `decideSettlement(jobState: JobState, deadlineAt: Date, now: Date): SettlementAction` with `SettlementAction = 'payout_dispute' | 'payout_timeout' | 'expire' | 'wait'`; `runSettlement(jobs: JobMonitor, treasury: Treasury, now?: Date): Promise<SettlementReport>` with `SettlementReport = { checked: number; paidOut: string[]; expired: string[]; errors: { policyId: string; error: string }[] }`; cron-secured `GET /api/watcher`.

- [ ] **Step 1: Write the failing decision tests**

```ts
// tests/settlement.test.ts
import { describe, it, expect } from 'vitest';
import { decideSettlement } from '@/lib/settlement/decide';

const deadline = new Date('2026-07-14T12:00:00Z');
const before = new Date('2026-07-14T11:00:00Z');
const after = new Date('2026-07-14T12:00:01Z');

describe('decideSettlement', () => {
  it('dispute verdict beats everything, even before deadline', () =>
    expect(decideSettlement('provider_fault', deadline, before)).toBe('payout_dispute'));
  it('delivered → expire (coverage ends, no payout)', () =>
    expect(decideSettlement('delivered', deadline, before)).toBe('expire'));
  it('pending past deadline → payout_timeout', () =>
    expect(decideSettlement('pending', deadline, after)).toBe('payout_timeout'));
  it('pending before deadline → wait', () =>
    expect(decideSettlement('pending', deadline, before)).toBe('wait'));
  it('delivered past deadline still expires without payout', () =>
    expect(decideSettlement('delivered', deadline, after)).toBe('expire'));
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL (module not found).

- [ ] **Step 3: Implement the decision**

```ts
// lib/settlement/decide.ts
import type { JobState } from '../okx/types';

export type SettlementAction = 'payout_dispute' | 'payout_timeout' | 'expire' | 'wait';

// Trigger priority per spec §10: dispute verdict first, then timeout.
export function decideSettlement(jobState: JobState, deadlineAt: Date, now: Date): SettlementAction {
  if (jobState === 'provider_fault') return 'payout_dispute';
  if (jobState === 'delivered') return 'expire';
  if (now.getTime() > deadlineAt.getTime()) return 'payout_timeout';
  return 'wait';
}
```

- [ ] **Step 4: Run tests** — `npm test` → all passing.

- [ ] **Step 5: Implement the executor**

```ts
// lib/settlement/run.ts
import type { JobMonitor, Treasury } from '../okx/types';
import { decideSettlement } from './decide';
import {
  getActivePolicies, getPendingClaims, getPolicy, markClaimPaid, markPolicy, openClaim,
} from '../store';

export interface SettlementReport {
  checked: number;
  paidOut: string[];
  expired: string[];
  errors: { policyId: string; error: string }[];
}

export async function runSettlement(
  jobs: JobMonitor, treasury: Treasury, now: Date = new Date(),
): Promise<SettlementReport> {
  const report: SettlementReport = { checked: 0, paidOut: [], expired: [], errors: [] };

  // Pass 1: active policies → decide → open claims / expire
  for (const p of await getActivePolicies()) {
    report.checked++;
    try {
      const state = await jobs.getJobState(p.job_ref);
      const action = decideSettlement(state, new Date(p.deadline_at), now);
      if (action === 'wait') continue;
      if (action === 'expire') { await markPolicy(p.id, 'expired'); report.expired.push(p.id); continue; }
      const trigger = action === 'payout_dispute' ? 'dispute_verdict' : 'delivery_timeout';
      const claim = await openClaim(p.id, trigger, Number(p.coverage_usdt)); // null if already claimed (pays-once)
      if (claim) await markPolicy(p.id, 'claim_pending');
    } catch (e) {
      report.errors.push({ policyId: p.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  // Pass 2: pending claims → pay (this IS the retry queue: failures stay pending)
  for (const c of await getPendingClaims()) {
    try {
      const policy = await getPolicy(c.policy_id);
      if (!policy) continue;
      if (c.trigger === 'manual') {
        // manual claims are verified against job state before paying
        const state = await jobs.getJobState(policy.job_ref);
        const action = decideSettlement(state, new Date(policy.deadline_at), now);
        if (action !== 'payout_dispute' && action !== 'payout_timeout') continue; // not (yet) payable
      }
      const { txHash } = await treasury.sendUsdt(
        policy.buyer_wallet, Number(c.amount_usdt), `Lloyd claim ${c.id} on policy ${policy.id}`,
      );
      await markClaimPaid(c.id, txHash);
      await markPolicy(policy.id, 'paid_out');
      report.paidOut.push(policy.id);
    } catch (e) {
      report.errors.push({ policyId: c.policy_id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return report;
}
```

- [ ] **Step 6: Write the watcher route + cron config**

```ts
// app/api/watcher/route.ts
import { runSettlement } from '@/lib/settlement/run';
import { getJobMonitor, getTreasury } from '@/lib/okx';

export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return new Response('unauthorized', { status: 401 });
  const report = await runSettlement(getJobMonitor(), getTreasury());
  return Response.json(report);
}
```

```json
// vercel.json
{ "crons": [{ "path": "/api/watcher", "schedule": "*/10 * * * *" }] }
```

Note: `*/10` cron needs Vercel Pro; on Hobby, cron fires daily and the rehearsal/demo trigger the watcher directly with curl — functionally identical.

- [ ] **Step 7: End-to-end settlement smoke test (fixture mode, local)**

Via MCP Inspector: fresh `get_quote` for `marlowe` with **`buyer_wallet: "0xPEPYS-2"`** (Task 7 Step 3 already holds an active 0xPEPYS+marlowe policy — the pair rule would refuse a second), then `bind_policy` with `job_ref: "job-demo-fail"`, deadline 2 minutes out. Then:

```bash
# flip the demo job and run the watcher:
npx tsx --env-file=.env.local -e "
import('./lib/db').then(async ({ supabaseAdmin }) => {
  await supabaseAdmin.from('demo_jobs').update({ state: 'provider_fault' }).eq('job_ref', 'job-demo-fail');
  console.log('job flipped to provider_fault');
});"
curl -s -H "Authorization: Bearer change-me" http://localhost:3000/api/watcher | jq
```

Expected: `paidOut: ["<policy_id>"]` — pass 1 opens the claim, pass 2 pays it in the same invocation — and the dev-server console shows `[treasury:fixture] send 16 USDT → 0xPEPYS-2`. Run curl again → `paidOut: []` (pays-once holds).

- [ ] **Step 8: Verify ledger integrity** — Supabase: `select kind, amount_usdt from ledger_events order by id;`
Expected rows: `seed +300`, `premium +1.4` (Task 7 bind), `premium +1.4` (this bind), `payout -16` → pool 286.80.

- [ ] **Step 9: Commit**

```bash
git add lib/settlement app/api/watcher vercel.json tests/settlement.test.ts
git commit -m "feat: settlement — pure trigger logic, retrying executor, cron watcher"
```

---

### Task 9: Real OKX adapters (shaped by Task 0 findings)

**Files:**
- Create: `lib/okx/real.ts`
- Modify: `lib/okx/index.ts` (factory switches), `.env.local` (real credentials)

**Interfaces:**
- Consumes: interfaces from Task 5; verified commands/endpoints from `docs/okx-notes.md`.
- Produces: `cliTreasury: Treasury` (env-templated transfer command), `httpJobMonitor: JobMonitor` (only if unknown #2 = available). Factory returns real impls when `LLOYD_MODE=real`; reputation stays db-backed with manually-curated dossiers if no API exists (documented limitation, stated in pitch).

- [ ] **Step 1: Implement the env-templated treasury** — mechanism is fixed now; the exact command comes from `docs/okx-notes.md` §5 and lives in env, not code:

```ts
// lib/okx/real.ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { JobMonitor, JobState, Treasury } from './types';

const exec = promisify(execFile);

// TREASURY_TRANSFER_CMD example (actual command recorded in docs/okx-notes.md §5):
//   okx transfer --to {to} --amount {amount} --token USDT --memo {note} --json
// The command MUST print JSON containing a tx hash field named in TREASURY_TX_HASH_FIELD.
export const cliTreasury: Treasury = {
  async sendUsdt(toWallet, amountUsdt, note) {
    const template = process.env.TREASURY_TRANSFER_CMD;
    if (!template) throw new Error('TREASURY_TRANSFER_CMD not configured');
    const [bin, ...args] = template
      .replaceAll('{to}', toWallet)
      .replaceAll('{amount}', String(amountUsdt))
      .replaceAll('{note}', note)
      .split(' ');
    const { stdout } = await exec(bin, args, { timeout: 60_000 });
    const parsed = JSON.parse(stdout);
    const field = process.env.TREASURY_TX_HASH_FIELD ?? 'txHash';
    const txHash = parsed[field];
    if (typeof txHash !== 'string' || !txHash) throw new Error(`no tx hash in transfer output (field: ${field})`);
    return { txHash };
  },
};

// Only used if docs/okx-notes.md §2 says job/escrow state is API-readable.
// OKX_JOB_STATE_URL example: https://web3.okx.com/api/v1/.../jobs/{jobRef}
export const httpJobMonitor: JobMonitor = {
  async getJobState(jobRef): Promise<JobState> {
    const url = process.env.OKX_JOB_STATE_URL!.replaceAll('{jobRef}', encodeURIComponent(jobRef));
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${process.env.OKX_API_KEY ?? ''}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`job state fetch failed: ${res.status}`);
    const body = await res.json();
    // Field mapping recorded in docs/okx-notes.md §2 when verified:
    if (body.disputeVerdict === 'provider_fault') return 'provider_fault';
    if (body.escrowReleased === true) return 'delivered';
    return 'pending';
  },
};
```

- [ ] **Step 2: Switch the factory**

```ts
// lib/okx/index.ts  (replace file)
import { dbJobMonitor, dbReputationSource, loggingTreasury } from './fixtures';
import { cliTreasury, httpJobMonitor } from './real';
import type { JobMonitor, ReputationSource, Treasury } from './types';

const real = () => process.env.LLOYD_MODE === 'real';

export function getReputationSource(): ReputationSource {
  return dbReputationSource; // curated dossiers; swap when a reputation API is confirmed
}
export function getJobMonitor(): JobMonitor {
  return real() && process.env.OKX_JOB_STATE_URL ? httpJobMonitor : dbJobMonitor;
}
export function getTreasury(): Treasury {
  return real() && process.env.TREASURY_TRANSFER_CMD ? cliTreasury : loggingTreasury;
}
```

- [ ] **Step 3: Fill `.env.local`** from `docs/okx-notes.md`: `LLOYD_MODE=real`, `TREASURY_TRANSFER_CMD=...`, `TREASURY_TX_HASH_FIELD=...`, and `OKX_JOB_STATE_URL`/`OKX_API_KEY` only if verified available.

- [ ] **Step 4: $1-scale real transfer test**

```bash
npx tsx --env-file=.env.local -e "
import('./lib/okx').then(async ({ getTreasury }) => {
  const r = await getTreasury().sendUsdt(process.env.TEST_WALLET!, 1, 'lloyd treasury smoke test');
  console.log('real payout tx:', r.txHash);
});"
```

Expected: a real tx hash; 1 USDT arrives in your test wallet. If unknown #5 turned out to be an HTTP API instead of a CLI, wrap it in a one-line shell script so `TREASURY_TRANSFER_CMD` still works — the interface doesn't change.

- [ ] **Step 5: Run full test suite** — `npm test` → all passing (real adapters never run in tests; factories default to fixtures without env).

- [ ] **Step 6: Commit**

```bash
git add lib/okx .env.example
git commit -m "feat: real OKX adapters — env-templated treasury, optional job monitor"
```

(Also create `.env.example` mirroring `.env.local` keys with blank values — safe to commit.)

---

### Task 10: Lloyd's Ledger (public dashboard)

**Files:**
- Create: `app/page.tsx` (replace scaffold default), `app/globals.css` (trim scaffold)

**Interfaces:**
- Consumes: `getLedgerStats`, `recentActivity` (Task 3).
- Produces: public `/` page: pool, outstanding coverage, utilization bar, policies written, claims paid, recent policies/claims tables with tx hashes. No auth (public by design).

- [ ] **Step 1: Write the page**

```tsx
// app/page.tsx
import { getLedgerStats, recentActivity } from '@/lib/store';

export const revalidate = 30; // refresh every 30s

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function Ledger() {
  const [stats, activity] = await Promise.all([getLedgerStats(), recentActivity()]);
  const utilization = stats.poolUsdt > 0 ? stats.outstandingUsdt / stats.poolUsdt : 0;

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '3rem 1.5rem', fontFamily: 'Georgia, serif' }}>
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2.2rem', marginBottom: 4 }}>Lloyd&apos;s Ledger</h1>
        <p style={{ color: '#666' }}>
          The underwriter of the agent economy — every policy, claim, and payout, in public.{' '}
          <a href="/about">About Lloyd</a>
        </p>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: '2.5rem' }}>
        {[
          ['Capital pool', `$${fmt(stats.poolUsdt)}`],
          ['Outstanding coverage', `$${fmt(stats.outstandingUsdt)}`],
          ['Pool utilization', `${(utilization * 100).toFixed(1)}% of 50% max`],
          ['Policies written', String(stats.policiesWritten)],
          ['Claims paid', String(stats.claimsPaid)],
        ].map(([label, value]) => (
          <div key={label} style={{ border: '1px solid #ddd', borderRadius: 8, padding: '1rem' }}>
            <div style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
            <div style={{ fontSize: '1.5rem', marginTop: 4 }}>{value}</div>
          </div>
        ))}
      </section>

      <h2>Recent policies</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem', fontSize: '0.9rem' }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
          <th style={{ padding: 6 }}>Policy</th><th>Provider</th><th>Coverage</th><th>Deadline</th><th>Status</th>
        </tr></thead>
        <tbody>
          {activity.policies.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 6, fontFamily: 'monospace' }}>{p.id.slice(0, 8)}</td>
              <td>{p.provider_id}</td>
              <td>${fmt(Number(p.coverage_usdt))}</td>
              <td>{new Date(p.deadline_at).toUTCString().slice(5, 22)}</td>
              <td>{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Recent claims</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
          <th style={{ padding: 6 }}>Claim</th><th>Trigger</th><th>Amount</th><th>Status</th><th>Tx</th>
        </tr></thead>
        <tbody>
          {activity.claims.map((c) => (
            <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 6, fontFamily: 'monospace' }}>{c.id.slice(0, 8)}</td>
              <td>{c.trigger}</td>
              <td>${fmt(Number(c.amount_usdt))}</td>
              <td>{c.status}</td>
              <td style={{ fontFamily: 'monospace' }}>{c.tx_hash ? c.tx_hash.slice(0, 14) + '…' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <footer style={{ marginTop: '3rem', color: '#888', fontSize: '0.85rem' }}>
        Solvency rules: coverage ≤ 50% of pool · ≤10% per provider · pays-once enforced in the database.
      </footer>
    </main>
  );
}
```

- [ ] **Step 2: Trim scaffold CSS** — reduce `app/globals.css` to a minimal reset (`* { box-sizing: border-box } body { margin: 0; color: #1a1a1a; background: #fdfcf9 }`) and delete scaffold assets (`app/page.module.css`, unused svgs).

- [ ] **Step 3: Verify** — `npm run dev`, open http://localhost:3000.
Expected: stats reflect Task 8's run (pool = 286.80: seed 300 + two premiums of 1.40 − payout 16), one paid claim visible.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx app/globals.css
git commit -m "feat: Lloyd's Ledger public dashboard"
```

---

### Task 11: Landing page (listing copy + docs)

**Files:**
- Create: `app/about/page.tsx`

**Interfaces:**
- Consumes: nothing dynamic.
- Produces: `/about` — the human-readable pitch + tool documentation that the OKX listing and demo video point to.

- [ ] **Step 1: Write the page**

```tsx
// app/about/page.tsx
const S = { h2: { marginTop: '2rem' } as const, code: { background: '#f4f1ea', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace', fontSize: '0.9em' } as const };

export default function About() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '3rem 1.5rem', fontFamily: 'Georgia, serif', lineHeight: 1.6 }}>
      <h1 style={{ fontSize: '2.2rem' }}>Lloyd</h1>
      <p style={{ fontSize: '1.2rem', color: '#555' }}>
        <em>The underwriter of the agent economy.</em> Delivery protection for agent work on OKX.AI —
        priced from onchain reputation in seconds, paid out automatically when a job fails.
      </p>

      <h2 style={S.h2}>Why</h2>
      <p>
        In 1686, strangers learned to trade across oceans because a man named Edward Lloyd gave them a room
        to price risk. Escrow protects agents from theft — nothing protects them from failure. Lloyd sells
        that protection: pay a small premium, and if the agent you hired doesn&apos;t deliver by the deadline
        (or loses the dispute), Lloyd pays you <strong>80% of the job value</strong>, automatically.
      </p>

      <h2 style={S.h2}>How agents use it</h2>
      <ol>
        <li><span style={S.code}>get_quote(provider_id, buyer_wallet, job_value_usdt, job_type)</span> — free. Lloyd reads the provider&apos;s onchain record and returns a premium (risk class A: 3%, B: 7%, C: 15%) or declines.</li>
        <li><span style={S.code}>bind_policy(quote_id, job_ref, deadline_at)</span> — the paid call. Premium is the price. Coverage active immediately.</li>
        <li>Hire the provider as usual. If the job is delivered — done, no action.</li>
        <li>If it isn&apos;t: Lloyd&apos;s settlement watcher detects the failure and pays your wallet. No claim forms. <span style={S.code}>get_policy</span> / <span style={S.code}>file_claim</span> exist for status checks and edge cases.</li>
      </ol>

      <h2 style={S.h2}>Solvency, in public</h2>
      <p>
        An insurer&apos;s only real product is trust, so Lloyd&apos;s books are public: capital pool, outstanding
        coverage, every claim and payout hash — live on the <a href="/">Ledger</a>. Hard rules enforced in code:
        coverage never exceeds 50% of the pool, no provider concentrates more than 10%, one policy per
        buyer–provider pair, and a policy can pay out exactly once — guaranteed by a database constraint,
        not a promise.
      </p>

      <h2 style={S.h2}>What Lloyd is not</h2>
      <p>
        Not a rating agency, not an arbitrator — disputes belong to OKX&apos;s staked evaluator network; Lloyd
        pays on its verdicts. Not ML theater: pricing is a deterministic, auditable scorecard that will learn
        as the economy&apos;s loss history accrues.
      </p>

      <p style={{ marginTop: '3rem', color: '#888' }}>
        Built for the OKX.AI Genesis Hackathon, July 2026. Roadmap: certification-linked premium discounts,
        provider-side coverage, reinsurance capacity.
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Verify** — open http://localhost:3000/about → renders, links to Ledger work both ways.

- [ ] **Step 3: Commit**

```bash
git add app/about
git commit -m "feat: landing page — pitch and tool docs"
```

---

### Task 12: Rehearsal script — Marlowe & Pepys end-to-end

**Files:**
- Create: `scripts/rehearsal.ts`

**Interfaces:**
- Consumes: the deployed (or local) MCP endpoint (Task 6), watcher route (Task 8), Supabase (demo_jobs flip).
- Produces: one command that runs the whole demo lifecycle and asserts every step — the thing we run on camera and before every deploy.

- [ ] **Step 1: Write the script**

```ts
// scripts/rehearsal.ts
// Usage: npx tsx --env-file=.env.local scripts/rehearsal.ts [baseUrl]
// Runs the full Marlowe & Pepys lifecycle against a running Lloyd instance.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const JOB = `job-rehearsal-${Date.now()}`;
// unique default buyer per run — avoids the one-active-policy-per-pair refusal on reruns
const PEPYS = process.env.TEST_WALLET ?? `0xPEPYS-${Date.now()}`;

async function callTool(client: Client, name: string, args: Record<string, unknown>) {
  const res = await client.callTool({ name, arguments: args });
  const text = (res.content as { type: string; text: string }[])[0].text;
  console.log(`\n▸ ${name}(${JSON.stringify(args)})\n  → ${text}`);
  return JSON.parse(text);
}

async function main() {
  const transport = new StreamableHTTPClientTransport(new URL(`${BASE}/api/mcp/mcp`));
  const client = new Client({ name: 'pepys', version: '1.0.0' });
  await client.connect(transport);

  // Register the rehearsal job as pending
  await db.from('demo_jobs').upsert({ job_ref: JOB, state: 'pending' });

  // 1. Pepys quotes Marlowe for a $20 job
  const quote = await callTool(client, 'get_quote', {
    provider_id: 'marlowe', buyer_wallet: PEPYS, job_value_usdt: 20, job_type: 'research',
  });
  assert.equal(quote.decision, 'quote');
  assert.equal(quote.premium_usdt, 1.4);   // spec demo number
  assert.equal(quote.coverage_usdt, 16);   // 80% of 20

  // 2. Fraud check: mallory's linked buyer is declined
  const fraud = await callTool(client, 'get_quote', {
    provider_id: 'mallory', buyer_wallet: '0xMALLORY-BUYER', job_value_usdt: 20, job_type: 'research',
  });
  assert.equal(fraud.reason, 'linked_wallets');

  // 3. Bind with a 1-minute deadline
  const deadline = new Date(Date.now() + 60_000).toISOString();
  const bound = await callTool(client, 'bind_policy', {
    quote_id: quote.quote_id, job_ref: JOB, deadline_at: deadline,
  });
  assert.equal(bound.ok, true);

  // 4. Marlowe blows the deadline (no delivery). Wait it out.
  console.log('\n… waiting 70s for the deadline to pass …');
  await new Promise((r) => setTimeout(r, 70_000));

  // 5. Watcher settles
  const watcher = await fetch(`${BASE}/api/watcher`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  }).then((r) => r.json());
  console.log('\n▸ watcher →', JSON.stringify(watcher));
  assert.ok(watcher.paidOut.includes(bound.policy_id), 'policy should have paid out');

  // 6. Policy is paid_out; pays-once holds on a second run
  const status = await callTool(client, 'get_policy', { policy_id: bound.policy_id });
  assert.equal(status.status, 'paid_out');
  const again = await fetch(`${BASE}/api/watcher`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  }).then((r) => r.json());
  assert.equal(again.paidOut.length, 0, 'no double payout');

  console.log('\n✅ rehearsal complete: quote → bind → fail → automatic payout → pays-once verified');
  await client.close();
}
main().catch((e) => { console.error('\n❌ rehearsal failed:', e); process.exit(1); });
```

- [ ] **Step 2: Run locally in fixture mode**

Run: `npx tsx --env-file=.env.local scripts/rehearsal.ts`
Expected: all assertions pass, `✅ rehearsal complete`. (Timeout trigger — no dispute flip needed; that path was proven in Task 8 Step 7.)

- [ ] **Step 3: Kill-switch drill** — set `KILL_SWITCH=true` in `.env.local`, restart dev server, re-run rehearsal.
Expected: fails at bind with `kill_switch_active` — correct behavior. Revert to `false`, restart.

- [ ] **Step 4: Commit**

```bash
git add scripts/rehearsal.ts
git commit -m "test: end-to-end rehearsal — full lifecycle, fraud decline, pays-once, kill-switch"
```

---

### Task 13: Production deploy + go-live

**Files:**
- Modify: Vercel project settings (env), `docs/okx-notes.md` (record prod URLs)

**Interfaces:**
- Consumes: everything.
- Produces: live production Lloyd; ASP listing pointing at `https://<prod>/api/mcp/mcp`; treasury seeded with real USDT.

- [ ] **Step 1: Set production env vars**

```bash
for k in SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY CRON_SECRET LLOYD_MODE KILL_SWITCH TREASURY_TRANSFER_CMD TREASURY_TX_HASH_FIELD; do
  npx vercel env add $k production
done
```

(`CRON_SECRET`: generate fresh — `openssl rand -hex 24`. `LLOYD_MODE=real`, `KILL_SWITCH=false`.)

- [ ] **Step 2: Deploy** — `npx vercel deploy --prod` → Expected: build green, prod URL live.

- [ ] **Step 3: Seed production pool for real** — fund the Agentic Wallet with the treasury amount you're comfortable with (200–500 USDT per spec; even 50 works at demo scale), then run seed against prod Supabase with the matching number: `SEED_POOL_USDT=200 npx tsx --env-file=.env.local scripts/seed.ts`. **The ledger seed must not exceed what the wallet actually holds** — the Ledger is public and must be honest.

- [ ] **Step 4: Production rehearsal** — `npx tsx --env-file=.env.local scripts/rehearsal.ts https://<prod-url>`
Expected: full pass with a **real payout tx hash** visible on the Ledger.

- [ ] **Step 5: Finalize ASP listing** — update the OKX.AI registration (Task 0 Step 3) with the production MCP URL, pricing per `docs/okx-notes.md` §1 (dynamic premium if supported, else Skiff $1 / Frigate $2.50 / Galleon $5 brackets with coverage $10/$25/$50), and the Ledger link. Respond to any review feedback same-day — this gate decides eligibility.

- [ ] **Step 6: Commit + tag**

```bash
git add -A && git commit -m "chore: production config" && git tag v1.0.0
```

---

### Task 14: Demo video + submission (July 14–15)

**Files:**
- Create: `docs/demo-script.md` (shot list), final video file (outside repo)

**Interfaces:**
- Consumes: live production Lloyd, rehearsal script, Ledger.
- Produces: ≤90s video posted on X with #OKXAI; completed Google form; HackQuest submission.

- [ ] **Step 1: Write the shot list** (`docs/demo-script.md`) — timed to 90s:
  - 0–10s: Title card. "Escrow protects agents from theft. Nothing protects them from failure." Lloyd wordmark.
  - 10–30s: Split screen: two buyers hire Marlowe for identical $20 jobs. Right side: Pepys calls `get_quote` → `bind_policy` (terminal capture of the rehearsal script, premium **$1.40** on screen).
  - 30–50s: Marlowe blows the deadline. Left buyer: dispute form, frustration. Right: watcher log line fires.
  - 50–70s: **16 USDT lands in Pepys's wallet — real tx hash on screen**, Ledger flips to "claim paid".
  - 70–90s: Ledger wide shot (public solvency). Closing card: *"In 1686, strangers learned to trade across oceans because a man named Lloyd gave them a room to price risk. Agents just got theirs."* + "Lloyd — live on OKX.AI" + #OKXAI.

- [ ] **Step 2: Record raw footage** — run `scripts/rehearsal.ts` against production with screen capture on terminal + Ledger + wallet; capture the OKX.AI listing page.

- [ ] **Step 3: Cut to ≤90s** — any editor; text overlays for the three numbers that matter: $1.40 premium, $16.00 payout, seconds-to-settlement.

- [ ] **Step 4: Post on X** with #OKXAI from the project handle; pin it.

- [ ] **Step 5: Submit the Google form** (link on the HackQuest hackathon page) with ASP details + X post link; complete HackQuest submission. **Deadline discipline: all of this lands July 15**, leaving July 16–17 purely for review feedback.

- [ ] **Step 6: Commit**

```bash
git add docs/demo-script.md
git commit -m "docs: demo shot list; submission complete"
```

---

## Calendar mapping

| Date | Tasks |
|---|---|
| Jul 9 | Task 0 (human gate first), Task 1 |
| Jul 10 | Tasks 2, 3, 4 |
| Jul 11 | Tasks 5, 6, 7 |
| Jul 12 | Task 8, start 9 |
| Jul 13 | Tasks 9, 10, 11 |
| Jul 14 | Tasks 12, 13, start 14 |
| Jul 15 | Task 14 — **submitted** |
| Jul 16–17 | Buffer: OKX review feedback, social push |

## Spec-coverage self-review (done)

- Spec §6 tools → Task 6 (with documented deviation: bind carries job_ref/deadline). §7 scorecard → Task 2. §8 coverage terms → Task 2 constants + Task 6 validation. §9 solvency/kill-switch/velocity → Tasks 4, 6; public tx trail → Tasks 3 (ledger_events), 10. §10 settlement priority + pays-once-by-constraint → Tasks 3 (unique claims.policy_id), 8. §11 fraud → Tasks 2 (linkage decline), 4 (pair/velocity), 7 (mallory fixture), 12 (asserted). §12 error handling → single-use quotes (Task 3 unique + CAS), retry queue (Task 8 pass 2), kill-switch (Tasks 4, 12). §13 testing → Tasks 2, 4, 8 unit; 12 e2e + drills. §14 demo → Task 14. §15 plan → calendar above. §16 unknowns → Task 0 verification, Task 9 fallbacks, Task 13 brackets. §17 risks → accepted, no task needed.
