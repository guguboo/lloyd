'use client';

import { ScrollText, HandCoins, ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PolicyRow, ClaimRow } from '@/lib/store';
import { cn } from '@/lib/utils';
import { txUrl, addressUrl, TREASURY } from '@/lib/chain';
import { useNetwork } from '@/components/network-context';

function VerifyLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-verdigris/80 transition-colors hover:text-verdigris-lit"
    >
      {children}
      <ExternalLink size={12} strokeWidth={1.8} />
    </a>
  );
}

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
  good: 'text-verdigris bg-[oklch(0.85_0.02_250/0.10)] ring-[oklch(0.85_0.02_250/0.30)]',
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

// CSS entrance (.row-in in globals.css): runs at first paint, no JS, no motion lib.
function Row({ i, children }: { i: number; children: ReactNode }) {
  return (
    <tr className="row-in align-middle" style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}>
      {children}
    </tr>
  );
}

export function LedgerTables({ policies, claims }: { policies: PolicyRow[]; claims: ClaimRow[] }) {
  const { network } = useNetwork();
  // Every "Verify" resolves to a real, funded onchain wallet. Testnet: a settled
  // policy points to the recipient that actually received its payout; an unsettled
  // one points to the treasury standing behind it (placeholder buyer wallets aren't
  // real onchain). Mainnet: Lloyd's real Agentic Wallet identity, since testnet
  // artifacts don't exist on mainnet.
  const policyHref = (p: PolicyRow) =>
    network === 'mainnet'
      ? addressUrl('mainnet', TREASURY.mainnet.address)
      : addressUrl('testnet', p.buyer_wallet);

  // Show only what is real onchain for the selected wallet. Testnet: every policy is
  // anchored onchain (its buyer wallet holds a real tx) and every paid claim carries a
  // real payout tx. Mainnet: nothing exists onchain yet, so the tables are honestly empty.
  const shownPolicies = network === 'testnet' ? policies : [];
  // Only real onchain payouts: a settlement run in fixture mode writes a placeholder hash,
  // which must never appear as a (dead) explorer link. Require a real 0x tx hash.
  const isOnchainTx = (h: string | null) => !!h && /^0x[0-9a-fA-F]{64}$/.test(h);
  const shownClaims = network === 'testnet' ? claims.filter((c) => isOnchainTx(c.tx_hash)) : [];

  // Claims carry the payout amount; the underlying job value lives on the linked policy.
  const jobValueByPolicy = new Map(policies.map((p) => [p.id, Number(p.job_value_usdt)]));

  const policyEmpty =
    network === 'testnet'
      ? 'No policies onchain yet.'
      : 'No policies exist on X Layer mainnet yet. Switch to Test wallet for Lloyd’s live, onchain-anchored policies.';
  const claimEmpty =
    network === 'testnet'
      ? 'No claims have paid out onchain yet.'
      : 'No claims have paid out on X Layer mainnet yet. The Test wallet shows real, verifiable payouts.';

  return (
    <div className="grid gap-5">
      <Panel
        icon={<ScrollText size={18} strokeWidth={1.6} />}
        title="Policies"
        count={shownPolicies.length}
        isEmpty={shownPolicies.length === 0}
        empty={policyEmpty}
        head={
          <>
            <th>Policy</th>
            <th>Provider</th>
            <th>Tier</th>
            <th className="text-right">Job value</th>
            <th className="text-right">Coverage</th>
            <th>Deadline</th>
            <th>Status</th>
            <th>Onchain</th>
          </>
        }
      >
        {shownPolicies.map((p, i) => {
          const b = POLICY_BADGE[p.status] ?? { tone: 'calm' as Tone, label: p.status };
          return (
            <Row key={p.id} i={i}>
              <td className="font-mono text-xs text-muted">{p.id.slice(0, 8)}</td>
              <td className="max-w-[10rem] truncate text-parchment">{p.provider_id}</td>
              <td>
                <span className="rounded-md bg-[oklch(0.85_0.02_250/0.08)] px-2 py-0.5 text-xs capitalize text-verdigris">
                  {p.tier}
                </span>
              </td>
              <td className="text-right font-mono text-muted tnum">{money(Number(p.job_value_usdt))}</td>
              <td className="text-right font-mono text-parchment tnum">{money(Number(p.coverage_usdt))}</td>
              <td className="whitespace-nowrap font-mono text-xs text-muted">{deadline(p.deadline_at)}</td>
              <td>
                <Badge tone={b.tone}>{b.label}</Badge>
              </td>
              <td className="text-xs">
                <VerifyLink href={policyHref(p)}>Verify</VerifyLink>
              </td>
            </Row>
          );
        })}
      </Panel>

      <Panel
        icon={<HandCoins size={18} strokeWidth={1.6} />}
        title="Claims"
        count={shownClaims.length}
        isEmpty={shownClaims.length === 0}
        empty={claimEmpty}
        head={
          <>
            <th>Claim</th>
            <th>Trigger</th>
            <th className="text-right">Job value</th>
            <th className="text-right">Amount</th>
            <th>Status</th>
            <th>Tx</th>
          </>
        }
      >
        {shownClaims.map((c, i) => {
          const b = CLAIM_BADGE[c.status] ?? { tone: 'calm' as Tone, label: c.status };
          return (
            <Row key={c.id} i={i}>
              <td className="font-mono text-xs text-muted">{c.id.slice(0, 8)}</td>
              <td className="text-parchment">{TRIGGER[c.trigger] ?? c.trigger}</td>
              <td className="text-right font-mono text-muted tnum">
                {jobValueByPolicy.has(c.policy_id) ? money(jobValueByPolicy.get(c.policy_id)!) : '—'}
              </td>
              <td className="text-right font-mono text-parchment tnum">{money(Number(c.amount_usdt))}</td>
              <td>
                <Badge tone={b.tone}>{b.label}</Badge>
              </td>
              <td className="font-mono text-xs text-muted">
                {network === 'testnet' ? (
                  c.tx_hash ? (
                    <VerifyLink href={txUrl('testnet', c.tx_hash)}>{`${c.tx_hash.slice(0, 12)}…`}</VerifyLink>
                  ) : (
                    '—'
                  )
                ) : (
                  <VerifyLink href={addressUrl('mainnet', TREASURY.mainnet.address)}>Wallet</VerifyLink>
                )}
              </td>
            </Row>
          );
        })}
      </Panel>
    </div>
  );
}
