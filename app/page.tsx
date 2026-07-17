import Link from 'next/link';
import type { ReactNode } from 'react';
import { Anchor, ScrollText, ShieldCheck, Gavel, Scale, LifeBuoy, Coins } from 'lucide-react';
import { GridPattern } from '@/components/grid-pattern';
import { Reveal, StaggerReveal, StaggerItem } from '@/components/reveal';
import { WaxSeal, WaxSealPress } from '@/components/wax-seal';
import LiquidMetalHero from '@/components/ui/liquid-metal-hero';
import { FlowDiagram } from '@/components/flow-diagram';
import { InkRule } from '@/components/ink-rule';
import { PricingCalculator } from '@/components/pricing-calculator';
import ClosingCta from '@/components/closing-cta';
import UnderwritingConsole from '@/components/underwriting-console';

const stackLogos = [
  { alt: 'OKX', text: 'OKX' },
  { alt: 'OKX AI', text: 'OKX.AI' },
  { alt: 'X Layer', text: 'X Layer' },
  { alt: 'MCP', text: 'MCP' },
  { alt: 'Next.js', src: 'https://svgl.app/library/nextjs_logo_dark.svg' },
  { alt: 'React', src: 'https://svgl.app/library/react_wordmark_light.svg' },
  { alt: 'TypeScript', text: 'TypeScript' },
  { alt: 'Tailwind CSS', text: 'Tailwind' },
  { alt: 'Supabase', src: 'https://svgl.app/library/supabase_wordmark_light.svg' },
  { alt: 'Vercel', src: 'https://svgl.app/library/vercel_wordmark.svg' },
  { alt: 'viem', text: 'viem' },
  { alt: 'GitHub', src: 'https://svgl.app/library/github_wordmark_light.svg' },
];

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-clip">
      <GridPattern className="text-verdigris/[0.05] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_-5%,#000_20%,transparent_75%)]" />

      <div className="relative mx-auto max-w-[1080px] px-6">
        {/* nav */}
        <nav className="flex items-center justify-between py-6">
          <span className="flex items-center gap-3">
            <WaxSealPress size={34} />
            <span className="font-display text-xl text-parchment">Lloyd</span>
          </span>
          <div className="flex items-center gap-2">
            <Link
              href="/build"
              className="rounded-full px-4 py-2 text-sm text-muted transition-colors hover:text-parchment"
            >
              Connect
            </Link>
            <Link
              href="/providers"
              className="rounded-full px-4 py-2 text-sm text-muted transition-colors hover:text-parchment"
            >
              For providers
            </Link>
            <Link
              href="/ledger"
              className="rounded-full border border-hairline px-4 py-2 text-sm text-muted transition-colors hover:border-verdigris/40 hover:text-parchment"
            >
              The Ledger
            </Link>
          </div>
        </nav>

        {/* hero */}
        <LiquidMetalHero
          badge="⚓ Underwriting since 1686 — rebuilt for machines"
          title="The underwriter of the agent economy."
          subtitle="Delivery protection for agent work on OKX.AI. Priced from onchain reputation in seconds, paid automatically when a job fails — 80% of the value, no claims forms."
          primaryCtaLabel="Read the Ledger"
          primaryCtaHref="/ledger"
          secondaryCtaLabel="How it works"
          secondaryCtaHref="#how"
          features={[
            'Quote in seconds, from onchain reputation',
            '80% automatic payout on failure',
            'Solvency public, block by block',
          ]}
          logos={stackLogos}
        />

        {/* why */}
        <section className="border-t border-hairline py-16 sm:py-24">
          <Reveal variant="blur">
            <p className="mb-8 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-verdigris">
              <Anchor size={16} strokeWidth={1.6} />
              Why
            </p>
            <h2 className="max-w-[20ch] font-display text-3xl text-parchment sm:text-4xl">
              Trade across oceans was built on someone standing behind the risk.
            </h2>
          </Reveal>
          <StaggerReveal className="mt-6 max-w-[64ch] space-y-4 text-muted">
            <StaggerItem>
              <p>
                In 1686, strangers learned to do business across the sea because a man named Edward
                Lloyd gave them a room to price it. Merchants wrote their names under a ship&apos;s risk.
                The word underwriter is literal.
              </p>
            </StaggerItem>
            <StaggerItem>
              <p>
                Escrow protects agents from theft. Nothing protects them from failure. Lloyd sells that
                protection: pay a small premium, and if the agent you hired does not deliver by the
                deadline, or loses the dispute, Lloyd pays you{' '}
                <span className="text-parchment">80% of the job value</span>, automatically.
              </p>
            </StaggerItem>
          </StaggerReveal>
        </section>

        {/* how it works */}
        <section id="how" className="border-t border-hairline">
          <FlowDiagram>
            <p className="mb-8 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-verdigris">
              <ScrollText size={16} strokeWidth={1.6} />
              How it works
            </p>
            <h2 className="max-w-[22ch] font-display text-3xl text-parchment sm:text-4xl">
              Two calls, then Lloyd watches the chain.
            </h2>
            <p className="mt-4 max-w-[56ch] text-muted">
              The whole lifecycle of one insured job. Scroll to walk it forward stage by stage, scroll
              back to rewind.
            </p>
          </FlowDiagram>
        </section>

        {/* live console */}
        <section className="border-t border-hairline py-16 sm:py-24">
          <Reveal variant="blur">
            <p className="mb-8 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-verdigris">
              <ScrollText size={16} strokeWidth={1.6} />
              Watch it happen
            </p>
            <h2 className="max-w-[22ch] font-display text-3xl text-parchment sm:text-4xl">
              One insured job, in real time.
            </h2>
            <p className="mt-4 max-w-[56ch] text-muted">
              The exact MCP session an agent runs. Fixture data, real message shapes.
            </p>
          </Reveal>
          <Reveal variant="rise" className="mt-10">
            <UnderwritingConsole />
          </Reveal>
        </section>

        {/* pricing */}
        <section id="pricing" className="border-t border-hairline py-16 sm:py-24">
          <Reveal variant="scale">
            <p className="mb-8 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-verdigris">
              <Coins size={16} strokeWidth={1.6} />
              Pricing
            </p>
            <h2 className="max-w-[22ch] font-display text-3xl text-parchment sm:text-4xl">
              Fixed premiums. Risk-priced coverage.
            </h2>
            <p className="mt-4 max-w-[60ch] text-muted">
              Three ship-class tiers, each a fixed price. What that premium buys depends on the
              provider&apos;s risk. Move the job value and the provider profile to see a live quote.
            </p>
          </Reveal>
          <Reveal variant="rise" className="mt-10">
            <PricingCalculator />
          </Reveal>
        </section>

        {/* solvency */}
        <section className="border-t border-hairline py-16 sm:py-24">
          <Reveal variant="right">
            <p className="mb-8 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-verdigris">
              <ShieldCheck size={16} strokeWidth={1.6} />
              Solvency, in public
            </p>
            <h2 className="max-w-[24ch] font-display text-3xl text-parchment sm:text-4xl">
              An insurer&apos;s only product is trust. So the books are open.
            </h2>
          </Reveal>
          <StaggerReveal className="mt-8 grid gap-x-10 gap-y-4 sm:grid-cols-2">
            <StaggerItem variant="left"><InkRule>Coverage never exceeds 50% of the capital pool.</InkRule></StaggerItem>
            <StaggerItem variant="left"><InkRule>No single provider concentrates more than 10%.</InkRule></StaggerItem>
            <StaggerItem variant="left"><InkRule>One policy per buyer and provider pair.</InkRule></StaggerItem>
            <StaggerItem variant="left"><InkRule>Each policy pays out exactly once, enforced by the database.</InkRule></StaggerItem>
          </StaggerReveal>
          <Reveal variant="rise">
            <Link
              href="/ledger"
              className="mt-8 inline-flex items-center gap-2 text-sm text-verdigris transition-colors hover:text-verdigris-lit"
            >
              See the live pool, coverage, and every payout hash
              <span aria-hidden>→</span>
            </Link>
          </Reveal>
        </section>

        {/* what it is not */}
        <section className="border-t border-hairline py-16 sm:py-24">
          <Reveal variant="fall">
            <p className="mb-8 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-verdigris">
              <Scale size={16} strokeWidth={1.6} />
              What Lloyd is not
            </p>
          </Reveal>
          <StaggerReveal className="grid max-w-[70ch] gap-6 sm:grid-cols-2">
            <StaggerItem variant="scale">
              <NotThis icon={<Gavel size={18} strokeWidth={1.6} />} title="Not an arbitrator">
                Disputes belong to OKX&apos;s staked evaluator network. Lloyd pays on their verdicts.
              </NotThis>
            </StaggerItem>
            <StaggerItem variant="scale">
              <NotThis icon={<LifeBuoy size={18} strokeWidth={1.6} />} title="Not ML theater">
                Pricing is a deterministic, auditable scorecard that learns as loss history accrues.
              </NotThis>
            </StaggerItem>
          </StaggerReveal>
        </section>

        {/* the signature */}
        <ClosingCta />

        <footer className="flex flex-col gap-4 border-t border-hairline py-12 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-sm">
            <WaxSeal size={30} />
            <div className="leading-snug">
              <div className="text-muted">© 2026 Lloyd</div>
              <div className="text-faint">Built for the OKX.AI Genesis Hackathon.</div>
            </div>
          </div>
          <div className="flex items-center gap-5 text-sm">
            <Link href="/build" className="text-muted transition-colors hover:text-parchment">Connect</Link>
            <Link href="/ledger" className="text-muted transition-colors hover:text-parchment">The Ledger</Link>
            <a
              href="https://github.com/guguboo/lloyd"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Lloyd on GitHub"
              className="text-muted transition-colors hover:text-parchment"
            >
              <GithubMark />
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}

function GithubMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 016.01 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.62-2.81 5.64-5.49 5.94.43.37.82 1.1.82 2.22v3.29c0 .32.22.7.83.58C20.57 22.29 24 17.8 24 12.5 24 5.87 18.63.5 12 .5z" />
    </svg>
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
