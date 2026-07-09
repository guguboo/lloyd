import Link from 'next/link';
import { getLedgerStats, recentActivity } from '@/lib/store';
import { GridPattern } from '@/components/grid-pattern';
import { Marquee } from '@/components/marquee';
import { StatSlip, UtilizationMeter } from '@/components/stat-slip';
import { CountUp } from '@/components/count-up';
import { StatusDot } from '@/components/status-dot';
import { WaxSeal } from '@/components/wax-seal';
import { LedgerTables } from '@/components/ledger-tables';

export const dynamic = 'force-dynamic'; // render per request — live ledger, no build-time DB dependency

const money2 = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function Ledger() {
  const [stats, activity] = await Promise.all([getLedgerStats(), recentActivity()]);
  const utilization = stats.poolUsdt > 0 ? stats.outstandingUsdt / stats.poolUsdt : 0;

  const ticker: React.ReactNode[] = [
    ...activity.policies.slice(0, 10).map((p) => (
      <TickerItem key={`p-${p.id}`} text={`${p.tier.toUpperCase()} · ${p.provider_id} · ${money2(Number(p.coverage_usdt))} covered`} />
    )),
    ...activity.claims.filter((c) => c.status === 'paid').slice(0, 8).map((c) => (
      <TickerItem key={`c-${c.id}`} text={`PAID · ${money2(Number(c.amount_usdt))} settled`} lit />
    )),
  ];

  return (
    <div className="relative min-h-screen overflow-hidden">
      <GridPattern className="text-verdigris/[0.055] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_25%,transparent_78%)]" />

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
            <Link
              href="/about"
              className="shrink-0 rounded-full border border-hairline px-4 py-2 text-sm text-muted transition-colors hover:border-verdigris/40 hover:text-parchment"
            >
              About Lloyd
            </Link>
          </div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-faint">
            <StatusDot />
            Settlement watcher active
          </div>
        </header>

        {ticker.length > 0 && (
          <div className="glass-quiet mb-10 py-2.5">
            <Marquee items={ticker} />
          </div>
        )}

        <section className="mb-8 grid gap-5 lg:grid-cols-12">
          <div className="glass flex flex-col gap-5 p-6 lg:col-span-6 lg:row-span-2">
            <div>
              <div className="text-[0.7rem] uppercase tracking-[0.16em] text-faint">Capital pool</div>
              <p className="mt-2 max-w-[32ch] text-sm leading-relaxed text-muted">
                Held in public, paid out only to claims. This is what stands behind every policy.
              </p>
            </div>
            <div className="mt-auto">
              <div className="font-display text-5xl leading-none text-parchment tnum sm:text-6xl">
                <CountUp prefix="$" value={stats.poolUsdt} decimals={2} />
              </div>
              <div className="mt-5">
                <UtilizationMeter ratio={utilization} />
              </div>
            </div>
          </div>

          <StatSlip
            className="lg:col-span-6"
            label="Outstanding coverage"
            value={<CountUp prefix="$" value={stats.outstandingUsdt} decimals={2} />}
            sub="At risk across live policies"
          />
          <StatSlip
            className="lg:col-span-3"
            label="Policies written"
            value={<CountUp value={stats.policiesWritten} />}
          />
          <StatSlip
            className="lg:col-span-3"
            label="Claims paid"
            value={<CountUp value={stats.claimsPaid} />}
          />
        </section>

        <LedgerTables policies={activity.policies} claims={activity.claims} />

        <footer className="mt-10 border-t border-hairline pt-5 text-sm text-faint">
          Solvency, enforced in code: coverage never exceeds 50% of the pool, no provider above 10%, one policy per
          buyer and provider, and every policy pays out exactly once, guaranteed by a database constraint.
        </footer>
      </main>
    </div>
  );
}

function TickerItem({ text, lit = false }: { text: string; lit?: boolean }) {
  return (
    <span className="mx-6 inline-flex items-center gap-2.5">
      <span className={lit ? 'text-verdigris-lit' : 'text-verdigris/60'}>◆</span>
      <span className="font-mono text-xs text-muted">{text}</span>
    </span>
  );
}
