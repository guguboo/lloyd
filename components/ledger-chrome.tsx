'use client';

import { ExternalLink, Wallet, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { addressUrl, TREASURY, type Network } from '@/lib/chain';
import { useNetwork } from '@/components/network-context';

const TABS: { key: Network; label: string }[] = [
  { key: 'testnet', label: 'Test' },
  { key: 'mainnet', label: 'Live' },
];

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** The Test/Live settlement-wallet switch. Lives in the ledger navbar. */
export function WalletSwitch() {
  const { network, setNetwork } = useNetwork();
  // Equal-width tabs + one CSS-translated pill: same slide as framer's layoutId, no motion lib.
  const idx = TABS.findIndex((t) => t.key === network);
  return (
    <div className="flex items-center gap-2">
      <Wallet size={15} strokeWidth={1.7} className="text-faint" aria-hidden />
      <div
        role="tablist"
        aria-label="Settlement wallet network"
        className="relative grid grid-cols-2 rounded-full border border-hairline p-0.5"
      >
        <span
          aria-hidden
          className="absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-verdigris transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ transform: `translateX(${idx * 100}%)` }}
        />
        {TABS.map((t) => {
          const active = t.key === network;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => setNetwork(t.key)}
              className={cn(
                'relative z-10 rounded-full px-3.5 py-1.5 text-sm transition-colors',
                active ? 'text-ink' : 'text-muted hover:text-parchment',
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The onchain anchor for the Capital Pool card: the real wallet standing behind it. */
export function PoolAnchor() {
  const { network } = useNetwork();
  const t = TREASURY[network];
  return (
    <a
      href={addressUrl(network, t.address)}
      target="_blank"
      rel="noopener noreferrer"
      className="group mt-4 inline-flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-hairline pt-4 text-xs"
    >
      <span className="text-muted transition-colors group-hover:text-parchment">{t.label}</span>
      <span className="font-mono text-faint">{short(t.address)}</span>
      <span className="inline-flex items-center gap-1 text-verdigris/80 transition-colors group-hover:text-verdigris-lit">
        Verify balance onchain
        <ExternalLink size={12} strokeWidth={1.8} />
      </span>
    </a>
  );
}

/** Honest disclosure: what is real onchain vs. what is a demo-denominated figure. */
export function LedgerLegend() {
  const { network } = useNetwork();
  const copy =
    network === 'testnet'
      ? 'Live on X Layer testnet. The reserve is the settlement wallet’s real onchain balance; every policy is anchored onchain (its buyer wallet holds a real transaction) and every paid claim links to its real payout. Transactions carry a nominal OKB value to prove the rail; the dollar figures are each policy’s USDT-denominated terms.'
      : 'This is Lloyd’s production wallet identity on X Layer mainnet. The demo’s real, executed settlements live under the Test wallet; the dollar figures are USDT-denominated policy terms.';
  return (
    <p className="flex items-start gap-2 text-xs leading-relaxed text-faint">
      <Info size={13} strokeWidth={1.8} className="mt-0.5 shrink-0 text-verdigris/70" aria-hidden />
      <span className="max-w-[82ch]">{copy}</span>
    </p>
  );
}
