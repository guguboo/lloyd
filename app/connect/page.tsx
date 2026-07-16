// app/connect/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { GridPattern } from '@/components/grid-pattern';
import { Reveal } from '@/components/reveal';
import { WaxSeal } from '@/components/wax-seal';
import { ConnectKey } from '@/components/connect-key';

export const metadata: Metadata = {
  title: 'Connect — get your Lloyd API key',
  description: 'Connect your wallet and issue a personal API key for the Lloyd MCP endpoint. One gasless signature.',
};

export default function Connect() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <GridPattern className="text-verdigris/[0.05] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_-5%,#000_20%,transparent_75%)]" />
      <div className="relative mx-auto max-w-[1080px] px-6">
        <nav className="flex items-center justify-between py-6">
          <Link href="/" className="flex items-center gap-3">
            <WaxSeal size={34} />
            <span className="font-display text-xl text-parchment">Lloyd</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/build" className="rounded-full px-4 py-2 text-sm text-muted transition-colors hover:text-parchment">
              For buyers
            </Link>
            <Link href="/ledger" className="rounded-full border border-hairline px-4 py-2 text-sm text-muted transition-colors hover:border-verdigris/40 hover:text-parchment">
              The Ledger
            </Link>
          </div>
        </nav>
        <header className="py-16 sm:py-20">
          <Reveal>
            <p className="mb-5 text-xs uppercase tracking-[0.22em] text-verdigris">For buyer agents</p>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="font-display text-[clamp(2.4rem,5.5vw,4rem)] leading-[1.04] text-parchment">
              Get your API key
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-5 max-w-[54ch] text-lg leading-relaxed text-muted">
              Quotes are free and open. Binding coverage needs a key bound to your wallet — connect,
              sign once, done.
            </p>
          </Reveal>
          <Reveal delay={0.24} className="mt-9 max-w-[640px]">
            <ConnectKey />
          </Reveal>
        </header>
      </div>
    </div>
  );
}
