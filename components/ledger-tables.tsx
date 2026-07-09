'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ScrollText, HandCoins } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PolicyRow, ClaimRow } from '@/lib/store';
import { cn } from '@/lib/utils';

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const deadline = (iso: string) => new Date(iso).toUTCString().slice(5, 22);

const TRIGGER: Record<ClaimRow['trigger'], string> = {
  dispute_verdict: 'Dispute verdict',
  delivery_timeout: 'Delivery timeout',
  manual: 'Manual',
};

type Tone = 'good' | 'wait' | 'calm' | 'bad';

const TONE: Record<Tone, string> = {
  good: 'text-verdigris bg-[oklch(0.72_0.11_175/0.10)] ring-[oklch(0.72_0.11_175/0.30)]',
  wait: 'text-brass bg-[oklch(0.70_0.09_70/0.10)] ring-[oklch(0.70_0.09_70/0.30)]',
  calm: 'text-muted bg-transparent ring-hairline',
  bad: 'text-terracotta bg-[oklch(0.62_0.10_40/0.10)] ring-[oklch(0.62_0.10_40/0.30)]',
};

function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONE[tone],
      )}
    >
      {children}
    </span>
  );
}

const POLICY_BADGE: Record<PolicyRow['status'], { tone: Tone; label: string }> = {
  active: { tone: 'good', label: 'In force' },
  paid_out: { tone: 'good', label: 'Paid out' },
  claim_pending: { tone: 'wait', label: 'In review' },
  expired: { tone: 'calm', label: 'Lapsed' },
};

const CLAIM_BADGE: Record<ClaimRow['status'], { tone: Tone; label: string }> = {
  paid: { tone: 'good', label: 'Paid' },
  sending: { tone: 'wait', label: 'Sending' },
  pending: { tone: 'wait', label: 'Pending' },
};

function Panel({
  icon,
  title,
  count,
  head,
  children,
  empty,
  isEmpty,
}: {
  icon: ReactNode;
  title: string;
  count: number;
  head: ReactNode;
  children: ReactNode;
  empty: string;
  isEmpty: boolean;
}) {
  return (
    <section className="glass overflow-hidden">
      <header className="flex items-center gap-2.5 border-b border-hairline px-5 py-3.5">
        <span className="text-verdigris">{icon}</span>
        <h2 className="font-display text-lg text-parchment">{title}</h2>
        <span className="ml-auto text-xs tabular-nums text-faint">{count} recent</span>
      </header>
      {isEmpty ? (
        <p className="px-5 py-8 text-sm text-faint">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[0.68rem] uppercase tracking-[0.12em] text-faint [&>th]:px-5 [&>th]:py-2.5 [&>th]:font-medium">
                {head}
              </tr>
            </thead>
            <tbody className="[&>tr]:border-t [&>tr]:border-hairline/70 [&>tr>td]:px-5 [&>tr>td]:py-3">
              {children}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Row({ i, children }: { i: number; children: ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <tr className="align-middle">{children}</tr>;
  return (
    <motion.tr
      className="align-middle"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: Math.min(i * 0.03, 0.3) }}
    >
      {children}
    </motion.tr>
  );
}

export function LedgerTables({ policies, claims }: { policies: PolicyRow[]; claims: ClaimRow[] }) {
  return (
    <div className="grid gap-5">
      <Panel
        icon={<ScrollText size={18} strokeWidth={1.6} />}
        title="Policies"
        count={policies.length}
        isEmpty={policies.length === 0}
        empty="No policies written yet. The first bound risk appears here."
        head={
          <>
            <th>Policy</th>
            <th>Provider</th>
            <th>Tier</th>
            <th className="text-right">Coverage</th>
            <th>Deadline</th>
            <th>Status</th>
          </>
        }
      >
        {policies.map((p, i) => {
          const b = POLICY_BADGE[p.status] ?? { tone: 'calm' as Tone, label: p.status };
          return (
            <Row key={p.id} i={i}>
              <td className="font-mono text-xs text-muted">{p.id.slice(0, 8)}</td>
              <td className="max-w-[10rem] truncate text-parchment">{p.provider_id}</td>
              <td>
                <span className="rounded-md bg-[oklch(0.72_0.11_175/0.08)] px-2 py-0.5 text-xs capitalize text-verdigris">
                  {p.tier}
                </span>
              </td>
              <td className="text-right font-mono text-parchment tnum">{money(Number(p.coverage_usdt))}</td>
              <td className="whitespace-nowrap font-mono text-xs text-muted">{deadline(p.deadline_at)}</td>
              <td>
                <Badge tone={b.tone}>{b.label}</Badge>
              </td>
            </Row>
          );
        })}
      </Panel>

      <Panel
        icon={<HandCoins size={18} strokeWidth={1.6} />}
        title="Claims"
        count={claims.length}
        isEmpty={claims.length === 0}
        empty="No claims filed. When a job fails, the payout lands here."
        head={
          <>
            <th>Claim</th>
            <th>Trigger</th>
            <th className="text-right">Amount</th>
            <th>Status</th>
            <th>Tx</th>
          </>
        }
      >
        {claims.map((c, i) => {
          const b = CLAIM_BADGE[c.status] ?? { tone: 'calm' as Tone, label: c.status };
          return (
            <Row key={c.id} i={i}>
              <td className="font-mono text-xs text-muted">{c.id.slice(0, 8)}</td>
              <td className="text-parchment">{TRIGGER[c.trigger] ?? c.trigger}</td>
              <td className="text-right font-mono text-parchment tnum">{money(Number(c.amount_usdt))}</td>
              <td>
                <Badge tone={b.tone}>{b.label}</Badge>
              </td>
              <td className="font-mono text-xs text-muted">
                {c.tx_hash ? `${c.tx_hash.slice(0, 12)}…` : '—'}
              </td>
            </Row>
          );
        })}
      </Panel>
    </div>
  );
}
