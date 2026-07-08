# Lloyd — Build Summary (autonomous session, 2026-07-09)

**Lloyd** = per-job micro-insurance ASP for the OKX.AI agent economy. Agents buy delivery protection on jobs they hire out; if the job fails, Lloyd auto-pays 80% of the value from a capital pool. Priced from onchain reputation, solvency public.

Branch: **`lloyd-build`** (17 commits since branch point; not merged — work continues where you left the human gate).

## What got built & reviewed ✅

Every task went implement → independent review → fix-loop. All on the models you specified (Opus for logic/money/reviews, Sonnet for mechanical). **50 tests passing, tsc clean, production build passes.**

| # | Piece | State |
|---|---|---|
| 1 | Next.js + Vitest + Supabase scaffold | ✅ reviewed |
| 2 | Tiered pricing engine (Skiff/Frigate/Galleon, risk classes A/B/C) | ✅ opus-verified numbers |
| 3 | Schema + store — pays-once & single-use enforced in DB | ✅ approved after 2 fix rounds |
| 4 | Solvency gate (50% pool / 10% provider / velocity / kill-switch) | ✅ reviewed |
| 5 | OKX adapter interfaces + fixtures | ✅ reviewed |
| 6 | MCP endpoint — get_quote / bind_policy / get_policy / file_claim | ✅ opus-approved |
| 7 | Seed script (pool + demo agents Marlowe/Fletcher/Mallory) | ✅ reviewed |
| 8 | Settlement watcher + payout | ✅ opus-approved |
| 10 | Lloyd's Ledger (public dashboard) | ✅ reviewed |
| 11 | Landing / about page | ✅ reviewed, browser-smoked (0 errors) |
| — | **Security fix H1/D7**: two-phase payout send (no on-chain double-spend on crash) | ✅ built + opus-reviewed + tested |
| — | **Whole-backend security audit (Opus)** | ✅ done — see §Security |
| — | **Final whole-branch review (Opus)** | ✅ **merge-ready for fixture demo** |

The design decisions made along the way (tiered pricing, all the money-safety fixes, the security posture) are recorded in `.superpowers/sdd/decisions.md` (D1–D9). Task-by-task reports and the full review trail are in `.superpowers/sdd/`.

## Security — the important context 🔒

A full adversarial audit ran. **On the current fixture wiring, no real USDT can move — building/testing/demoing is safe.** It found 4 issues that only bite when a *real treasury is exposed to untrusted agents* ("go-live"):

- **C1** — a stranger could invent a fake `job_ref` and collect a payout for it.
- **C2** — self-dealing isn't truly blocked yet (linkage is a static list).
- **C3** — the premium isn't verified on the public endpoint.
- **H1** — double-payout on a crash → **already fixed** (two-phase send).

**Decision made (reversible, flag if you disagree):** the demo runs *contained* (fixture mode or a throwaway wallet holding exactly the small pool, endpoint unadvertised — the auditor endorses this as safe), and C1/C2/C3 become **hard requirements gating mainnet**, folded into Task 9. Full checklist in `decisions.md §D9`. This audit is also **pitch gold** — "we audited ourselves and published a pre-mainnet checklist" is underwriter-grade credibility.

## What's left — all blocked on you 🚦

Tasks 12 (live rehearsal), 13 (deploy), 14 (demo video + submission) need live infrastructure. See **`NEEDS-YOU.md`** for the ordered checklist. The single unblocker for the most: **paste the Supabase `service_role` key into `.env.local`** — then the live rehearsal, real payout test, and Ledger browser test all run in one command each.

## Resume pointer

Everything is on `lloyd-build`. Ledger of exactly what's done: `.superpowers/sdd/progress.md`. When you're back with the key + funded wallet + Vercel login, the remaining path is: seed prod pool → live Marlowe/Pepys rehearsal (Task 12) → deploy + activate the OKX service listing (Task 13) → film + submit (Task 14, by Jul 15).
