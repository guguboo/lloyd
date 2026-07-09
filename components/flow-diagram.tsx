'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useInView } from 'framer-motion';
import { FileSearch, ShieldCheck, Cpu, Scale, Flag, type LucideIcon } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1] as const;

type Stage = { key: string; label: string; icon: LucideIcon; call: string; title: string; body: string };

const STAGES: Stage[] = [
  { key: 'quote', label: 'Quote', icon: FileSearch, call: 'get_quote', title: 'Ask for a price. Free.', body: 'The buyer agent calls get_quote. Lloyd reads the provider\'s onchain reputation, classifies its risk, and returns three fixed-price tiers with the coverage each buys.' },
  { key: 'bind', label: 'Bind', icon: ShieldCheck, call: 'bind_policy', title: 'Bind the policy. Paid.', body: 'The buyer calls bind_policy and pays the tier\'s fixed premium. Coverage is live the instant it is written, up to 80% of the job value.' },
  { key: 'work', label: 'Work', icon: Cpu, call: 'hire provider', title: 'The job runs.', body: 'The buyer hires the provider as usual and sets a deadline. Lloyd stays out of the way while the work happens.' },
  { key: 'settle', label: 'Settle', icon: Scale, call: 'watcher', title: 'Lloyd checks the chain.', body: 'At the deadline, Lloyd\'s settlement watcher reads the job state and any dispute verdict directly from the chain. No claim forms, no waiting on a human.' },
  { key: 'outcome', label: 'Outcome', icon: Flag, call: '', title: 'Two endings.', body: '' },
];

const OUTCOME = {
  delivered: { chip: 'Delivered', tone: 'good', body: 'The provider delivered on time. Nothing is owed, the premium stays in the pool, and the policy closes.' },
  failed: { chip: 'Failed', tone: 'pay', body: 'The provider missed the deadline or lost the dispute. Lloyd pays 80% of the job value straight to the buyer\'s wallet, onchain, automatically.' },
} as const;

export function FlowDiagram() {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { amount: 0.3 });
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [outcome, setOutcome] = useState<'delivered' | 'failed'>('failed');

  // Autoplay only once the section is scrolled into view, never on page load.
  useEffect(() => {
    if (reduce || !playing || !inView) return;
    const t = setInterval(() => setActive((a) => (a + 1) % STAGES.length), 2600);
    return () => clearInterval(t);
  }, [playing, reduce, inView]);

  const pct = (active / (STAGES.length - 1)) * 100;
  const isOutcome = active === STAGES.length - 1;
  const stage = STAGES[active];

  return (
    <div
      ref={rootRef}
      onMouseEnter={() => setPlaying(false)}
      onMouseLeave={() => setPlaying(true)}
    >
      {/* timeline */}
      <div className="relative">
        <div className="absolute left-5 right-5 top-6 h-px bg-hairline" />
        <motion.div
          className="absolute left-5 top-6 h-px bg-verdigris"
          style={{ maxWidth: 'calc(100% - 2.5rem)' }}
          animate={{ width: `calc(${pct}% - ${pct / 100} * 2.5rem)` }}
          transition={{ duration: 0.6, ease: EASE }}
        />
        <div className="relative flex justify-between">
          {STAGES.map((s, i) => {
            const Icon = s.icon;
            const done = i <= active;
            const current = i === active;
            return (
              <button
                key={s.key}
                onClick={() => setActive(i)}
                className="group flex w-16 flex-col items-center gap-2 sm:w-20"
                aria-label={s.label}
              >
                <motion.span
                  className="flex h-12 w-12 items-center justify-center rounded-full border"
                  animate={{
                    borderColor: done ? 'oklch(0.72 0.11 175 / 0.5)' : 'oklch(0.72 0.11 175 / 0.16)',
                    backgroundColor: done ? 'oklch(0.72 0.11 175 / 0.12)' : 'oklch(0.22 0.024 205 / 0.4)',
                    scale: current ? 1.12 : 1,
                    boxShadow: current ? '0 0 0 5px oklch(0.72 0.11 175 / 0.10)' : '0 0 0 0 transparent',
                  }}
                  transition={{ duration: 0.4, ease: EASE }}
                >
                  <Icon size={19} strokeWidth={1.6} className={done ? 'text-verdigris' : 'text-faint'} />
                </motion.span>
                <span className={`text-xs transition-colors ${current ? 'text-parchment' : 'text-faint'}`}>
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* description */}
      <div className="glass mt-8 min-h-[168px] p-6">
        <motion.div
          key={`${active}-${isOutcome ? outcome : ''}`}
          initial={reduce ? false : { opacity: 0.35, y: 6 }}
          animate={reduce ? false : { opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
        >
          <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-display text-2xl text-parchment">{stage.title}</h3>
              {stage.call && (
                <code className="rounded bg-[oklch(0.72_0.11_175/0.08)] px-2 py-1 font-mono text-[0.7rem] text-verdigris">
                  {stage.call}
                </code>
              )}
              {isOutcome && (
                <span
                  className={`ml-auto inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
                    OUTCOME[outcome].tone === 'good'
                      ? 'text-verdigris bg-[oklch(0.72_0.11_175/0.10)] ring-[oklch(0.72_0.11_175/0.30)]'
                      : 'text-brass bg-[oklch(0.70_0.09_70/0.10)] ring-[oklch(0.70_0.09_70/0.30)]'
                  }`}
                >
                  {OUTCOME[outcome].chip}
                </span>
              )}
            </div>
          <p className="mt-3 max-w-[64ch] leading-relaxed text-muted">
            {isOutcome ? OUTCOME[outcome].body : stage.body}
          </p>
        </motion.div>

        {isOutcome && (
          <div className="mt-5 inline-flex rounded-full border border-hairline p-1">
            {(['delivered', 'failed'] as const).map((o) => (
              <button
                key={o}
                onClick={() => setOutcome(o)}
                className={`rounded-full px-4 py-1.5 text-xs capitalize transition-colors ${
                  outcome === o ? 'bg-verdigris text-ink' : 'text-muted hover:text-parchment'
                }`}
              >
                {o}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
