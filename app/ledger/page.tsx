import Link from 'next/link';
import { Suspense } from 'react';
import { recentActivity } from '@/lib/store';
import { getOnchainBalances } from '@/lib/onchain';
import { GridPattern } from '@/components/grid-pattern';
import { PageWash } from '@/components/page-wash';
import { StatusDot } from '@/components/status-dot';
import { WaxSeal } from '@/components/wax-seal';
import { LedgerTables } from '@/components/ledger-tables';
import { LedgerHero } from '@/components/ledger-hero';
import { NetworkProvider } from '@/components/network-context';
import { WalletSwitch, LedgerLegend } from '@/components/ledger-chrome';

export const dynamic = 'force-dynamic'; // render per request — live ledger, no build-time DB dependency

// The data-dependent half of the page, streamed behind Suspense so the shell paints
// immediately instead of blanking for the DB + RPC round trips.
async function LedgerLive() {
  const [activity, balances] = await Promise.all([recentActivity(), getOnchainBalances()]);
  return (
    <>
      <LedgerHero balances={balances} policies={activity.policies} claims={activity.claims} />
      <div className="mb-5">
        <LedgerLegend />
      </div>
      <LedgerTables policies={activity.policies} claims={activity.claims} />
    </>
  );
}

function LedgerSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden>
      <section className="mb-8 grid gap-5 lg:grid-cols-12">
        <div className="glass min-h-56 lg:col-span-6 lg:row-span-2" />
        <div className="glass h-28 lg:col-span-6" />
        <div className="glass h-28 lg:col-span-3" />
        <div className="glass h-28 lg:col-span-3" />
      </section>
      <div className="grid gap-5">
        <div className="glass h-44" />
        <div className="glass h-44" />
      </div>
    </div>
  );
}

export default function Ledger() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <GridPattern className="text-verdigris/[0.055] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_25%,transparent_78%)]" />
      <PageWash />

      <NetworkProvider>
      <main className="relative mx-auto max-w-[1080px] px-6 py-14 sm:py-20">
        <header className="mb-10 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <WaxSeal size={44} className="opacity-90" />
              <div>
                <h1 className="font-display text-2xl leading-none text-parchment sm:text-3xl">Lloyd&apos;s Ledger</h1>
                <p className="mt-1 text-sm text-muted">Every policy, claim, and payout, in public.</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <WalletSwitch />
              <Link
                href="/build"
                className="rounded-full px-4 py-2 text-sm text-muted transition-colors hover:text-parchment"
              >
                Connect
              </Link>
              <Link
                href="/"
                className="rounded-full border border-hairline px-4 py-2 text-sm text-muted transition-colors hover:border-verdigris/40 hover:text-parchment"
              >
                Overview
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-faint">
            <StatusDot />
            Settlement watcher active
          </div>
        </header>

        <Suspense fallback={<LedgerSkeleton />}>
          <LedgerLive />
        </Suspense>

        <footer className="mt-10 border-t border-hairline pt-5 text-sm text-faint">
          Solvency, enforced in code: coverage never exceeds 50% of the pool, no provider above 10%, one policy per
          buyer and provider, and every policy pays out exactly once, guaranteed by a database constraint.
        </footer>
      </main>
      </NetworkProvider>
    </div>
  );
}
