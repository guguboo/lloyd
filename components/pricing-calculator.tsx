'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { coverageForTier, TIERS } from '@/lib/underwrite/engine';
import type { RiskClass, Tier } from '@/lib/underwrite/types';
import { cn } from '@/lib/utils';

const EASE = [0.16, 1, 0.3, 1] as const;

const PROFILES: { key: string; label: string; sub: string; riskClass: RiskClass; newcomer: boolean }[] = [
  { key: 'A', label: 'Proven', sub: 'Class A · 3%', riskClass: 'A', newcomer: false },
  { key: 'B', label: 'Established', sub: 'Class B · 7%', riskClass: 'B', newcomer: false },
  { key: 'C', label: 'Risky', sub: 'Class C · 15%', riskClass: 'C', newcomer: false },
  { key: 'N', label: 'New', sub: 'Unproven · $10 cap', riskClass: 'C', newcomer: true },
];

const TIER_META: Record<Tier, { name: string; blurb: string }> = {
  skiff: { name: 'Skiff', blurb: 'Small, quick jobs.' },
  frigate: { name: 'Frigate', blurb: 'Everyday agent work.' },
  galleon: { name: 'Galleon', blurb: 'High-value, critical jobs.' },
};

const ORDER: Tier[] = ['skiff', 'frigate', 'galleon'];
const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function PricingCalculator() {
  const [jobValue, setJobValue] = useState(18);
  const [profileKey, setProfileKey] = useState('B');

  const profile = PROFILES.find((p) => p.key === profileKey)!;
  const cover = (t: Tier) => coverageForTier(t, profile.riskClass, jobValue, profile.newcomer);
  const covs = { skiff: cover('skiff'), frigate: cover('frigate'), galleon: cover('galleon') };
  const max = Math.max(covs.skiff, covs.frigate, covs.galleon);
  const recommended: Tier = covs.skiff === max ? 'skiff' : covs.frigate === max ? 'frigate' : 'galleon';

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* controls */}
      <div className="glass flex flex-col gap-7 p-6 lg:col-span-5">
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="jobval" className="text-[0.7rem] uppercase tracking-[0.16em] text-faint">
              Job value
            </label>
            <span className="font-display text-2xl text-parchment tnum">{money(jobValue)}</span>
          </div>
          <input
            id="jobval"
            type="range"
            min={5}
            max={100}
            step={1}
            value={jobValue}
            onChange={(e) => setJobValue(Number(e.target.value))}
            className="mt-3 w-full accent-[oklch(0.85_0.02_250)]"
          />
          <div className="mt-1 flex justify-between text-xs text-faint">
            <span>$5</span>
            <span>$100</span>
          </div>
        </div>

        <div>
          <span className="text-[0.7rem] uppercase tracking-[0.16em] text-faint">Provider profile</span>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {PROFILES.map((p) => (
              <button
                key={p.key}
                onClick={() => setProfileKey(p.key)}
                className={cn(
                  'rounded-lg border px-3 py-2.5 text-left transition-colors',
                  profileKey === p.key
                    ? 'border-verdigris/50 bg-[oklch(0.85_0.02_250/0.10)]'
                    : 'border-hairline hover:border-verdigris/30',
                )}
              >
                <div className="text-sm text-parchment">{p.label}</div>
                <div className="font-mono text-[0.68rem] text-muted">{p.sub}</div>
              </button>
            ))}
          </div>
        </div>

        <p className="text-sm leading-relaxed text-muted">
          Premium is fixed per tier. Coverage is premium divided by the risk rate, capped at 80% of the job
          value, {money(50)} maximum, {money(10)} for unproven providers.
        </p>
      </div>

      {/* live tiers */}
      <div className="grid gap-4 sm:grid-cols-3 lg:col-span-7">
        {ORDER.map((t) => {
          const isRec = t === recommended;
          return (
            <div
              key={t}
              className={cn(
                'glass glass-hover flex flex-col gap-3 p-5',
                isRec && 'ring-1 ring-inset ring-verdigris/40',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-xl text-parchment">{TIER_META[t].name}</span>
                {isRec && (
                  <span className="rounded-full bg-[oklch(0.85_0.02_250/0.12)] px-2 py-0.5 text-[0.62rem] uppercase tracking-wider text-verdigris">
                    Best value
                  </span>
                )}
              </div>
              <div>
                <span className="text-[0.65rem] uppercase tracking-[0.14em] text-faint">Premium</span>
                <div className="font-mono text-lg text-parchment tnum">{money(TIERS[t])}</div>
              </div>
              <div>
                <span className="text-[0.65rem] uppercase tracking-[0.14em] text-faint">Coverage</span>
                <motion.div
                  key={covs[t]}
                  initial={{ opacity: 0.3, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="font-display text-2xl text-verdigris tnum"
                >
                  {money(covs[t])}
                </motion.div>
              </div>
              <p className="mt-auto text-xs text-muted">{TIER_META[t].blurb}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
