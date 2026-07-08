# 🧑‍💼 Needs You — Lloyd build

Things only you can do. Everything else proceeds without you. Updated automatically as the build runs.

## Before Task 9 (payout wiring — ~Jul 12–13)
- [ ] **Fund the Agentic Wallet** (`0xbf5698cfe8b3a4bc803951642e87b0db07b7be3f`) with USDT on X Layer. Minimum for dev: ~5 USDT (the $1 self-transfer test). Demo/treasury seed (~35–50+ USDT) can come at Task 13.
- [ ] **Be reachable for `onchainos wallet login` OTP** (email vicopratama449@gmail.com) — the payout CLI needs a logged-in session.

## Before Task 13 (go-live — ~Jul 14)
- [ ] **Decide treasury seed amount** (35–50 USDT minimum viable; 200+ for a substantial-looking Ledger).
- [ ] **Approve the service listing** — the OKX flow shows confirm cards only you can click. I'll have the exact copy ready (tiers: Skiff $0.75 / Frigate $1.50 / Galleon $3.50).

## Before Task 14 (submission — Jul 14–15)
- [ ] **Claim the X handle** (e.g. @LloydUnderwrites) and post the demo video with #OKXAI.
- [ ] **Submit the Google form** (link on the HackQuest page) + finalize HackQuest submission.

## 🔒 Security review done — one decision for you (not blocking the demo)

A full adversarial security audit of the backend ran (Opus). **Good news: in the current build no real money can move — the whole system runs on fixtures, so building/testing/demoing is safe.** But it found 4 issues that would matter *only if we wire a real treasury exposed to untrusted agents* (that's "go-live"). Headline: on mainnet, a stranger could invent a fake job reference and collect a payout for it (C1), and the premium isn't verified on the public endpoint (C3).

**My plan (proceeding unless you say otherwise):**
- Demo runs **contained** — fixture mode or a throwaway wallet holding exactly the small demo pool, endpoint not advertised. The auditor explicitly endorses this as safe.
- The 4 go-live fixes become **hard requirements gating mainnet exposure**, folded into Task 9 (the real-OKX wiring, which needs you anyway). Full checklist in `.superpowers/sdd/decisions.md` §D9.
- I'm turning the audit into **pitch material** — "we audited ourselves and published a pre-mainnet checklist" is the underwriter-grade credibility the submission wants.
- **Fixing one now** (H1: double-payout on a crash) since it needs no OKX specifics.

**Your call when you're back:** for the hackathon, is the contained demo + documented go-live checklist enough (my recommendation), or do you want the full mainnet hardening built out before submission? Reply anytime; I'll keep building the safe path meanwhile.

## Now active (flagged during the build)
- [ ] **🔑 MOST URGENT — Supabase service_role key**: open https://supabase.com/dashboard/project/qjudcjzaegurohurnuau/settings/api → copy the `service_role` key → paste it into `.env.local` as `SUPABASE_SERVICE_ROLE_KEY=<key>` (repo root, file already has the empty line). Blocks live verification of the MCP tools (Task 6) and everything DB-integrated after. (Alternative: run `supabase login` in a terminal and tell me — I can then fetch it without displaying it.)
- [ ] **Vercel CLI login** — run `npx vercel login` in a terminal (CLI returned `missing_scope` non-interactively). Needed before the production deploy at Task 13 (~Jul 14); nothing earlier blocks on it.

## Done ✅
- [x] HackQuest registration
- [x] Agentic Wallet created + consent (Account 1)
- [x] Lloyd ASP identity #4731 registered (with avatar)
