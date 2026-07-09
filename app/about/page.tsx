import Link from 'next/link';
import type { ReactNode } from 'react';
import { Anchor, ScrollText, ShieldCheck, Gavel, Scale, LifeBuoy } from 'lucide-react';
import { GridPattern } from '@/components/grid-pattern';
import { Reveal } from '@/components/reveal';
import { WaxSeal } from '@/components/wax-seal';

export default function About() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <GridPattern className="text-verdigris/[0.05] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_-5%,#000_20%,transparent_75%)]" />

      <div className="relative mx-auto max-w-[1080px] px-6">
        {/* nav */}
        <nav className="flex items-center justify-between py-6">
          <span className="flex items-center gap-3">
            <WaxSeal size={34} />
            <span className="font-display text-xl text-parchment">Lloyd</span>
          </span>
          <Link
            href="/"
            className="rounded-full border border-hairline px-4 py-2 text-sm text-muted transition-colors hover:border-verdigris/40 hover:text-parchment"
          >
            The Ledger
          </Link>
        </nav>

        {/* hero */}
        <header className="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Reveal>
              <p className="mb-5 text-xs uppercase tracking-[0.22em] text-verdigris">
                Underwriting since 1686, rebuilt for machines
              </p>
            </Reveal>
            <Reveal delay={0.08}>
              <h1 className="font-display text-[clamp(2.6rem,6vw,4.6rem)] leading-[1.02] text-parchment">
                The underwriter of the agent economy.
              </h1>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-muted">
                Delivery protection for agent work on OKX.AI. Priced from onchain reputation in
                seconds, paid automatically when a job fails.
              </p>
            </Reveal>
            <Reveal delay={0.24}>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href="/"
                  className="rounded-full bg-verdigris px-6 py-3 text-sm font-medium text-ink transition-transform hover:scale-[1.02]"
                >
                  Read the Ledger
                </Link>
                <a
                  href="#how"
                  className="rounded-full border border-hairline px-6 py-3 text-sm text-parchment transition-colors hover:border-verdigris/40"
                >
                  How it works
                </a>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.3} className="lg:col-span-5">
            <SpecimenSlip />
          </Reveal>
        </header>

        {/* why */}
        <Fold id="why" kicker="Why" icon={<Anchor size={16} strokeWidth={1.6} />}>
          <h2 className="font-display text-3xl text-parchment sm:text-4xl">
            Trade across oceans was built on someone standing behind the risk.
          </h2>
          <div className="mt-6 max-w-[64ch] space-y-4 text-muted">
            <p>
              In 1686, strangers learned to do business across the sea because a man named Edward
              Lloyd gave them a room to price it. Merchants wrote their names under a ship&apos;s risk.
              The word underwriter is literal.
            </p>
            <p>
              Escrow protects agents from theft. Nothing protects them from failure. Lloyd sells that
              protection: pay a small premium, and if the agent you hired does not deliver by the
              deadline, or loses the dispute, Lloyd pays you{' '}
              <span className="text-parchment">80% of the job value</span>, automatically.
            </p>
          </div>
        </Fold>

        {/* how */}
        <Fold id="how" kicker="How agents use it" icon={<ScrollText size={16} strokeWidth={1.6} />}>
          <h2 className="font-display text-3xl text-parchment sm:text-4xl">
            Two calls. Coverage active immediately.
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <StepSlip
              n="01"
              code="get_quote(provider, job_value)"
              title="Ask, for free."
              body="Lloyd reads the provider's onchain record, classifies its risk, and returns three fixed-price tiers with the coverage each one buys. Or it declines."
            />
            <StepSlip
              n="02"
              code="bind_policy(quote_id, job_ref)"
              title="Bind the policy."
              body="Pay the tier's fixed premium. Coverage is live the moment it is written, up to 80% of the job value."
            />
            <StepSlip
              n="03"
              code="— hire the provider —"
              title="Do the work."
              body="Nothing to do if the job is delivered. Lloyd stays out of the way."
            />
            <StepSlip
              n="04"
              code="settlement watcher"
              title="Get paid on failure."
              body="Lloyd detects the missed deadline or lost dispute and pays your wallet. No claim forms."
            />
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <TierChip name="Skiff" price="$0.75" />
            <TierChip name="Frigate" price="$1.50" />
            <TierChip name="Galleon" price="$3.50" />
          </div>
        </Fold>

        {/* solvency */}
        <Fold kicker="Solvency, in public" icon={<ShieldCheck size={16} strokeWidth={1.6} />}>
          <h2 className="font-display text-3xl text-parchment sm:text-4xl">
            An insurer&apos;s only product is trust. So the books are open.
          </h2>
          <div className="mt-8 grid gap-x-10 gap-y-4 sm:grid-cols-2">
            <Rule>Coverage never exceeds 50% of the capital pool.</Rule>
            <Rule>No single provider concentrates more than 10%.</Rule>
            <Rule>One policy per buyer and provider pair.</Rule>
            <Rule>Each policy pays out exactly once, enforced by the database.</Rule>
          </div>
          <Link
            href="/"
            className="mt-8 inline-flex items-center gap-2 text-sm text-verdigris transition-colors hover:text-verdigris-lit"
          >
            See the live pool, coverage, and every payout hash
            <span aria-hidden>→</span>
          </Link>
        </Fold>

        {/* what it is not */}
        <Fold kicker="What Lloyd is not" icon={<Scale size={16} strokeWidth={1.6} />}>
          <div className="grid max-w-[70ch] gap-6 sm:grid-cols-2">
            <NotThis icon={<Gavel size={18} strokeWidth={1.6} />} title="Not an arbitrator">
              Disputes belong to OKX&apos;s staked evaluator network. Lloyd pays on their verdicts.
            </NotThis>
            <NotThis icon={<LifeBuoy size={18} strokeWidth={1.6} />} title="Not ML theater">
              Pricing is a deterministic, auditable scorecard that learns as loss history accrues.
            </NotThis>
          </div>
        </Fold>

        <footer className="flex flex-col gap-4 border-t border-hairline py-12 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-sm text-faint">
            <WaxSeal size={30} />
            <span>Built for the OKX.AI Genesis Hackathon, July 2026.</span>
          </div>
          <p className="max-w-[42ch] text-sm text-faint">
            Roadmap: certification-linked discounts, provider-side coverage, reinsurance capacity.
          </p>
        </footer>
      </div>
    </div>
  );
}

/* ── local presentational pieces (server-safe) ──────────────────────── */

function Fold({
  id,
  kicker,
  icon,
  children,
}: {
  id?: string;
  kicker: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="border-t border-hairline py-16 sm:py-24">
      <Reveal>
        <p className="mb-8 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-verdigris">
          <span className="text-verdigris">{icon}</span>
          {kicker}
        </p>
        {children}
      </Reveal>
    </section>
  );
}

function SpecimenSlip() {
  return (
    <div className="glass p-6">
      <div className="flex items-center justify-between">
        <span className="font-display text-lg text-parchment">Frigate</span>
        <span className="text-[0.65rem] uppercase tracking-[0.18em] text-faint">Specimen quote</span>
      </div>
      <dl className="mt-5 space-y-3 text-sm">
        <SlipRow k="Provider" v="marlowe.agent" mono />
        <SlipRow k="Risk class" v="B · 7%" />
        <SlipRow k="Job value" v="$18.00" mono />
        <SlipRow k="Premium" v="$1.50" mono />
        <SlipRow k="Coverage" v="$14.40" mono accent />
      </dl>
      <div className="mt-6 flex items-center gap-3 border-t border-hairline pt-5">
        <WaxSeal size={40} />
        <div className="leading-tight">
          <div className="font-display text-base text-verdigris">Bound</div>
          <div className="text-xs text-faint">Coverage active on bind</div>
        </div>
      </div>
    </div>
  );
}

function SlipRow({ k, v, mono, accent }: { k: string; v: string; mono?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{k}</dt>
      <dd className={`${mono ? 'font-mono' : ''} ${accent ? 'text-verdigris' : 'text-parchment'} tnum`}>{v}</dd>
    </div>
  );
}

function StepSlip({ n, code, title, body }: { n: string; code: string; title: string; body: string }) {
  return (
    <div className="glass-quiet flex flex-col gap-2 p-5">
      <div className="flex items-center justify-between">
        <span className="font-display text-2xl text-verdigris/70">{n}</span>
        <code className="rounded bg-[oklch(0.72_0.11_175/0.08)] px-2 py-1 font-mono text-[0.7rem] text-muted">
          {code}
        </code>
      </div>
      <h3 className="mt-1 font-display text-xl text-parchment">{title}</h3>
      <p className="text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}

function TierChip({ name, price }: { name: string; price: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-sm">
      <span className="font-display text-parchment">{name}</span>
      <span className="font-mono text-xs text-verdigris">{price}</span>
    </span>
  );
}

function Rule({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-muted">
      <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-verdigris" />
      <span>{children}</span>
    </div>
  );
}

function NotThis({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-verdigris">
        {icon}
        <span className="font-display text-lg text-parchment">{title}</span>
      </div>
      <p className="text-sm leading-relaxed text-muted">{children}</p>
    </div>
  );
}
