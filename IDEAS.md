# OKX.AI Genesis Hackathon — Idea Book

**Hackathon:** [OKX.AI Genesis](https://www.hackquest.io/hackathons/OKXAI-Genesis-Hackathon) · Submit July 2–17, 2026 · Results July 23
**Requirements:** ASP live on OKX.AI (passes internal review) + ≤90s demo on X with #OKXAI + Google form
**Prizes:** Best Product / Creative Genius / Revenue Rocket $20K each · Finance Copilot / Software Utility / Lifestyle Companion / Artistic Excellence $7.5K each · Social Buzz 10×$1K

## The platform in one paragraph

OKX.AI (live July 1, 2026, ~50 beta ASPs) is a marketplace where agents discover work, transact, and build onchain reputation. Two payment modes: **A2A** (escrow, negotiated complex jobs) and **A2MCP** (instant pay-per-call for standardized services). Identity + payments via Agentic Wallet (USDT/USDG). Disputes resolved by a staked evaluator network. Launch partners already cover: security scanning (CertiK), market data (CoinAnk), dispute infra (GenLayer). Early gravity: trading, on-chain activity, crypto research.

**Strategic frame:** OKX built the rails (payments, escrow, reputation, disputes). Don't rebuild the rails and don't compete with launch partners. The winning ASP is either (a) a missing economic primitive every real economy has, or (b) a pick-and-shovel service other agents need to finish their own jobs.

---

## Round 1 — Utility ideas (safe lane)

### A. Web Verifier — "it works, here's proof"
- **What:** Pay-per-call browser QA. Input: URL + claim ("checkout works"). Output: verdict + screenshot evidence pack + action log.
- **Why:** Coding agents ship web apps and can't see them. Agent-pays-agent in its purest form.
- **Prior art:** QA SaaS exists for humans; agent-callable evidence-based verification is thin on OKX.AI. 🟡
- **Mode/Track:** A2MCP · Software Utility / Best Product / Revenue Rocket
- **Feasibility:** High (existing Playwright/webwright expertise) · **Demo:** strong (screenshots)

### B. Video Producer — brief → finished video
- **What:** Pay-per-call: product URL or brief (+ optional audio) → rendered 15–60s promo/explainer video (HyperFrames pipeline).
- **Why:** Video is slow/expensive; every commerce agent needs creatives. Meta-move: the agent produces its own hackathon submission video.
- **Prior art:** Text-to-video tools exist; a marketplace-callable end-to-end producer is rarer. 🟡
- **Mode/Track:** A2MCP · Creative Genius / Artistic Excellence / Social Buzz
- **Feasibility:** High (deep HyperFrames moat) · **Demo:** spectacular

### C. Crypto Research/Portfolio Analyst
- **What:** Pay-per-call deep reports on OKX's own agent-skills (smart-money, sentiment, indicators).
- **Prior art:** ❌ Crowded — the obvious idea; OKX tooling does 80%; CoinAnk adjacent.
- **Mode/Track:** A2MCP · Finance Copilot
- **Feasibility:** High · **Demo:** weak differentiation

---

## Round 2 — Creative ideas + prior-art verdicts

### 1. The Negotiator 🤝 — ❌ EXISTS
Hire it to fight bills/refunds; agents hire it for A2A deal-making.
**Prior art:** [DoNotPay](https://www.artificiallawyer.com/2022/12/12/my-ai-will-talk-to-your-ai-as-donotpay-joins-the-gpt-3-fray/) (consumer, since 2022), [Pactum](https://pactum.com/) (B2B procurement), a whole [directory category](https://aiagentstore.ai/get-ai-agent/bill-negotiation).

### 2. The Headhunter 🕵️ — ⚠️ ADJACENT ART
Pre-hire due diligence: interview/probe an ASP with test tasks before you escrow money.
**Prior art:** [Virtuals ACP evaluator agents](https://whitepaper.virtuals.io/about-virtuals/agent-commerce-protocol-acp) verify work post-hoc and earn a cut; OKX.AI's staked evaluator network resolves disputes; [VettedAIAgents](https://vettedaiagents.com/) is a human editorial directory. *Pre-hire probing* is open, but the trust territory is claimed.

### 3. The Skill Dealer 📦 — ❌ EXISTS, CROWDED
Sell tested, tailored skills to other agents.
**Prior art:** [Agensi](https://www.agensi.io/skills), [Skly](https://news.ycombinator.com/item?id=46961474), [LobeHub](https://lobehub.com/skills), [AISkillTrade](https://aiskilltrade.com/), [A2A Colony](https://a2acolony.com/) ("agents trade capabilities autonomously"), OKX's own skills marketplace.

### 4. The Last-Mile Human 🦿 — ❌ EXISTS EXACTLY
Agents hire humans for physical-world tasks.
**Prior art:** [RentAHuman.ai](https://rentahuman.ai/) — Feb 2026, 650K+ humans, 50+ countries, MCP + REST, crypto payments. [Forbes coverage](https://www.forbes.com/sites/ronschmelzer/2026/02/05/when-ai-agents-start-hiring-humans-rentahumanai-turns-the-tables/).

### 5. The Economy Journalist 📰 — 🟡 PARTIALLY OPEN
Bloomberg of OKX.AI: paid market intelligence on the agent economy; free viral teasers on X.
**Prior art:** observability tools (LangSmith, AgentOps) and [earning-platform listicles](https://dev.to/kirothebot/the-agent-economy-is-real-12-platforms-where-ai-agents-actually-earn-money-may-2026-5bm2) exist; a dedicated paid intelligence desk per marketplace doesn't. Thin moat; data-access risk.

### 6. The Security Guard 🛡️ — ❌ EXISTS ON-PLATFORM
Pre-transaction token/contract checks.
**Prior art:** **CertiK is an OKX.AI launch partner doing exactly this** ([The Block](https://www.theblock.co/post/406704/okx-ai-unveils-marketplace-for-agents-to-find-work-and-get-paid-in-stablecoins)); [GoPlus API](https://docs.gopluslabs.io/reference/getdefiinfousingget) + MCP servers; [RugCheck](https://chainaware.ai/blog/best-web3-rug-pull-detection-tools-2026/) et al.

---

## Round 3 — White space: unbuilt economic primitives

The agent economy has payments ✅ marketplaces ✅ skills ✅ physical labor ✅ security ✅ evaluation ✅ disputes ✅ data ✅ — but is missing what every real economy runs on:

### N1. The Underwriter 💰 — insurance for agent work ⭐ top pick (creative)
- **What:** Client hiring an unknown ASP buys a policy (small premium). If the deliverable fails (lost dispute / failed verification), instant payout. Premiums priced off the agent's onchain reputation, history, job size — actuarial pricing for agent labor.
- **Why unbuilt & why now:** evaluators judge work after the fact; **nobody prices and carries risk per-job at machine speed**. Plugs natively into OKX escrow + dispute rails (payout condition = dispute verdict). Insurance is OKX's mental home turf (insurance funds, margin).
- **Prior art (validation, not competition):** enterprise AI liability exists — [AIUC](https://fortune.com/2025/07/23/ai-agent-insurance-startup-aiuc-stealth-15-million-seed-nat-friedman/) ($15M seed, $50M policies, AIUC-1 standard, Beazley paper), [Munich Re aiSure](https://agentinsured.eu/articles/munich-re-aisure-parametric-ai-insurance-europe) (since 2018), [Armilla](https://www.armilla.ai/resources/insurance-firms-want-to-cash-in-on-the-ai-boom) (Lloyd's, $25M) — all slow, human-audited, enterprise-scale. For agent economies specifically, the [Agentic Risk Standard](https://fortune.com/2026/04/08/agent-hallucinations-protocol-money-financial-system-economy/) (Apr 2026; Microsoft Research, Columbia, DeepMind, Virtuals, T54) explicitly proposes third-party underwriting of agent tasks — **as a framework, with no shipped implementation**. Gap: micro-policies ($5–500 jobs), priced in seconds from onchain reputation, claims settled by dispute verdicts. Pitch line: "They proposed the standard in April; we shipped the first implementation."
- **Mode/Track:** A2MCP (quote + bind) · Creative Genius / Best Product
- **Feasibility:** Medium-high — needs a seeded capital pool, honest risk model, abuse controls
- **Demo:** buy policy → job fails → payout lands onchain in seconds. Visceral.

### N2. The Credit Bureau 🏦 — FICO score for agents
- **What:** Aggregate an agent's verifiable history (OKX.AI, Virtuals, x402 receipts) into one queryable credit score. Extension: working-capital microloans secured by in-flight escrow receivables (self-repaying when escrow releases).
- **Why unbuilt:** reputation is siloed per marketplace; agent-native credit doesn't exist.
- **Mode/Track:** A2MCP (score query) + A2A (loans) · Finance Copilot / Creative Genius
- **Feasibility:** Medium — cross-platform data access is the big risk
- **Demo:** query two agents' scores → lend against escrow → auto-repay.

### N3. The Certification Authority 🎓 — Michelin stars for agents
- **What:** Agents pay to sit standardized auto-graded exams ("crypto research L2", "web automation L3") → onchain certificate shown in their listing. Buyers filter by cert; certified agents charge more.
- **Why unbuilt:** benchmarks exist for models, not paid credentialing for marketplace agents.
- **Mode/Track:** A2MCP · Software Utility / Creative Genius
- **Feasibility:** High — the craft is designing 3 exams that are hard to game
- **Demo:** agent sits exam live → passes → cert appears onchain.

### N4. The Launch Agency 🚀 — the agency that launches agents ⭐ top pick (revenue)
- **What:** New ASPs are about to flood OKX.AI (this hackathon!) with zero discovery. Takes a new agent as client: rewrites listing, prices against live comps, produces launch video + X thread, gets first verified reviews.
- **Why unbuilt & why now:** human growth agencies exist; agent-native self-serve launcher doesn't. **Customers = other hackathon participants, during the judging window.**
- **Mode/Track:** A2MCP (tiered packages) · Revenue Rocket / Social Buzz
- **Feasibility:** High — content generation + market comps + (optionally) HyperFrames video
- **Demo:** before/after of a real fellow-hacker's listing + their testimonial.

### N5. The Bonded Courier 🔐 — secrets escrow between agents
- **What:** Scoped, time-boxed, revocable, audited credential handoff for agent-to-agent delegation (subcontractor needs your API key — today that's raw trust).
- **Why unbuilt:** secret managers serve humans/infra, not paid agent-to-agent brokering.
- **Mode/Track:** A2MCP · Software Utility
- **Feasibility:** Medium-high, security-sensitive · **Demo:** emotionally flat vs others.

---

## Ranking matrix

| Idea | Novelty | Feasibility (9d, solo) | Revenue in window | Demo wow | Best track |
|---|---|---|---|---|---|
| **N1 Underwriter** | ★★★★★ | ★★★☆☆ | ★★☆☆☆ | ★★★★★ | Creative Genius |
| **N4 Launch Agency** | ★★★★☆ | ★★★★★ | ★★★★★ | ★★★★☆ | Revenue Rocket |
| N3 Certification | ★★★★☆ | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | Software Utility |
| N2 Credit Bureau | ★★★★★ | ★★☆☆☆ | ★★☆☆☆ | ★★★★☆ | Finance Copilot |
| A Web Verifier | ★★★☆☆ | ★★★★★ | ★★★★☆ | ★★★★☆ | Software Utility |
| B Video Producer | ★★★☆☆ | ★★★★☆ | ★★★☆☆ | ★★★★★ | Artistic Excellence |
| N5 Bonded Courier | ★★★★☆ | ★★★☆☆ | ★★☆☆☆ | ★★☆☆☆ | Software Utility |
| 5 Economy Journalist | ★★★☆☆ | ★★★☆☆ | ★★☆☆☆ | ★★★☆☆ | Social Buzz |
| 2 Headhunter | ★★★☆☆ | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | Software Utility |
| C Crypto Analyst | ★☆☆☆☆ | ★★★★★ | ★★★☆☆ | ★★☆☆☆ | Finance Copilot |
| 1 Negotiator | ★☆☆☆☆ | — | — | — | (exists) |
| 3 Skill Dealer | ★☆☆☆☆ | — | — | — | (exists) |
| 4 Last-Mile Human | ☆☆☆☆☆ | — | — | — | (RentAHuman) |
| 6 Security Guard | ☆☆☆☆☆ | — | — | — | (CertiK on-platform) |

## Recommendation

- **Swinging for Creative Genius ($20K):** **N1 The Underwriter** — the missing financial primitive, natively wired to OKX's own escrow/dispute rails, in the judges' native language.
- **Maximizing odds of real money + a prize:** **N4 The Launch Agency** — perfectly timed, guaranteed customer pool (fellow hackers), highest shipping certainty.
- **Compose later (v2 story for the pitch):** N3 certification feeds N1 pricing (certified agents → cheaper premiums) — say it in the video as roadmap, don't build it.

## 7-day execution plan (once idea is picked)

| Day | Goal |
|---|---|
| 1 | HackQuest reg · Agentic Wallet + Onchain OS setup · **register ASP + submit service shell for OKX review** (unblock the human gate) · hello-world A2MCP call |
| 2–3 | Core pipeline end-to-end locally |
| 4 | Wire behind A2MCP endpoint · pricing · first real paid call |
| 5 | Deploy hardened · go live on marketplace · minimal landing/docs |
| 6 | ≤90s demo video · X post #OKXAI · Google form |
| 7+ | Buffer for review feedback · social push · collect first revenue |
