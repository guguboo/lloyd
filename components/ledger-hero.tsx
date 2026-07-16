'use client';

import { useNetwork } from '@/components/network-context';
import { Marquee } from '@/components/marquee';
import { StatSlip } from '@/components/stat-slip';
import { CountUp } from '@/components/count-up';
import { PoolAnchor } from '@/components/ledger-chrome';
import type { Balances } from '@/lib/onchain';
import type { PolicyRow, ClaimRow } from '@/lib/store';

const money2 = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const LIVE: PolicyRow['status'][] = ['active', 'claim_pending'];

// The hero sticks to the selected wallet, and every figure is derived from the real
// onchain data shown below. The reserve is each wallet's live USDT balance — the asset
// payouts are actually drawn from; outstanding, counts, and the ticker come from the
// policies and settled claims. Mainnet is the reserved production identity, so all zero.
export function LedgerHero({
  balances,
  policies,
  claims,
}: {
  balances: Balances;
  policies: PolicyRow[];
  claims: ClaimRow[];
}) {
  const { network } = useNetwork();
  const testnet = network === 'testnet';
  const bal = balances[network];
  const reserve = bal.usdt; // live USDT balance (the payout asset), or null if the RPC was unreachable
  const outstanding = testnet
    ? policies.filter((p) => LIVE.includes(p.status)).reduce((s, p) => s + Number(p.coverage_usdt), 0)
    : 0;
  const policiesOnchain = testnet ? policies.length : 0;
  const claimsPaid = testnet ? claims.filter((c) => c.status === 'paid').length : 0;

  const ticker =
    testnet
      ? [
          ...policies.map((p) => (
            <TickerItem
              key={`p-${p.id}`}
              text={`${p.tier.toUpperCase()} · ${p.provider_id} · ${money2(Number(p.coverage_usdt))} covered`}
            />
          )),
          ...claims
            .filter((c) => c.status === 'paid')
            .map((c) => (
              <TickerItem key={`c-${c.id}`} text={`PAID · ${money2(Number(c.amount_usdt))} settled`} lit />
            )),
        ]
      : [];

  return (
    <>
      {ticker.length > 0 && (
        <div className="glass-quiet mb-10 py-2.5">
          <Marquee items={ticker} />
        </div>
      )}

      <section className="mb-8 grid gap-5 lg:grid-cols-12">
        <div className="glass glass-hover flex flex-col gap-5 p-6 lg:col-span-6 lg:row-span-2">
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.16em] text-faint">Settlement reserve</div>
            <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-muted">
              {testnet
                ? 'The live USDT balance of Lloyd’s settlement wallet, read straight from X Layer. Every payout is a real USDT transfer drawn from here.'
                : 'Lloyd’s production wallet on X Layer mainnet, live and verifiable. Not yet funded.'}
            </p>
          </div>
          <div className="mt-auto">
            <div className="font-display text-5xl leading-none text-parchment tnum sm:text-6xl">
              {reserve === null ? (
                <span className="text-muted">—</span>
              ) : (
                <CountUp prefix="$" value={reserve} decimals={2} />
              )}
            </div>
            <p className="mt-3 text-xs text-faint">
              {reserve === null
                ? 'Balance temporarily unavailable — verify directly onchain.'
                : `USDT · X Layer ${testnet ? 'testnet' : 'mainnet'}${bal.okb !== null ? ` · gas ${bal.okb.toFixed(2)} OKB` : ''}`}
            </p>
            <PoolAnchor />
          </div>
        </div>

        <StatSlip
          className="glass-hover lg:col-span-6"
          label="Outstanding coverage"
          value={<CountUp prefix="$" value={outstanding} decimals={2} />}
          sub={testnet ? 'At risk across live policies' : 'No mainnet exposure yet'}
        />
        <StatSlip
          className="glass-hover lg:col-span-3"
          label="Policies"
          value={<CountUp value={policiesOnchain} />}
        />
        <StatSlip
          className="glass-hover lg:col-span-3"
          label="Claims paid"
          value={<CountUp value={claimsPaid} />}
        />
      </section>
    </>
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
