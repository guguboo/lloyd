'use client';

import Link from 'next/link';
import {
  motion,
  useMotionValue,
  useSpring,
  useReducedMotion,
  type Variants,
} from 'framer-motion';
import type { PointerEvent } from 'react';
import { WaxSeal } from '@/components/wax-seal';

const EASE = [0.16, 1, 0.3, 1] as const;

const headlineContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};
const headlineLine: Variants = {
  hidden: { y: '115%' },
  show: { y: '0%', transition: { duration: 0.85, ease: EASE } },
};
const soft = (delay: number): Variants => ({
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE, delay } },
});

export function Hero() {
  const reduce = useReducedMotion();

  return (
    <header className="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <motion.p
          className="mb-5 text-xs uppercase tracking-[0.22em] text-verdigris"
          variants={soft(0)}
          initial={reduce ? undefined : 'hidden'}
          animate={reduce ? undefined : 'show'}
        >
          Underwriting since 1686, rebuilt for machines
        </motion.p>

        {reduce ? (
          <h1 className="font-display text-[clamp(2.6rem,6vw,4.7rem)] leading-[1.02] text-parchment">
            The underwriter of the agent economy.
          </h1>
        ) : (
          <motion.h1
            className="font-display text-[clamp(2.6rem,6vw,4.7rem)] leading-[1.02] text-parchment"
            variants={headlineContainer}
            initial="hidden"
            animate="show"
          >
            <span className="clip-line">
              <motion.span className="block" variants={headlineLine}>
                The underwriter of
              </motion.span>
            </span>
            <span className="clip-line">
              <motion.span className="block" variants={headlineLine}>
                the agent economy.
              </motion.span>
            </span>
          </motion.h1>
        )}

        <motion.p
          className="mt-6 max-w-[46ch] text-lg leading-relaxed text-muted"
          variants={soft(0.5)}
          initial={reduce ? undefined : 'hidden'}
          animate={reduce ? undefined : 'show'}
        >
          Delivery protection for agent work on OKX.AI. Priced from onchain reputation in seconds,
          paid automatically when a job fails.
        </motion.p>

        <motion.div
          className="mt-9 flex flex-wrap items-center gap-3"
          variants={soft(0.62)}
          initial={reduce ? undefined : 'hidden'}
          animate={reduce ? undefined : 'show'}
        >
          <Link
            href="/ledger"
            className="rounded-full bg-verdigris px-6 py-3 text-sm font-medium text-ink transition-transform hover:scale-[1.03]"
          >
            Read the Ledger
          </Link>
          <a
            href="#how"
            className="rounded-full border border-hairline px-6 py-3 text-sm text-parchment transition-colors hover:border-verdigris/40"
          >
            How it works
          </a>
        </motion.div>
      </div>

      <div className="lg:col-span-5">
        <SpecimenSlip reduce={!!reduce} />
      </div>
    </header>
  );
}

function SpecimenSlip({ reduce }: { reduce: boolean }) {
  const rx = useSpring(useMotionValue(0), { stiffness: 140, damping: 18 });
  const ry = useSpring(useMotionValue(0), { stiffness: 140, damping: 18 });

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ry.set(px * 12);
    rx.set(-py * 12);
  };
  const onLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <div style={{ perspective: 900 }}>
      <motion.div
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        className="glass p-6"
        style={reduce ? undefined : { rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }}
        initial={reduce ? undefined : { opacity: 0, y: 26, scale: 0.92, rotateY: 14 }}
        animate={reduce ? undefined : { opacity: 1, y: 0, scale: 1, rotateY: 0 }}
        transition={{ duration: 0.9, ease: EASE, delay: 0.35 }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[0.65rem] uppercase tracking-[0.18em] text-faint">Sample policy</span>
          <span className="font-display text-lg text-parchment">Frigate</span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div>
            <div className="text-[0.62rem] uppercase tracking-[0.14em] text-faint">You pay</div>
            <div className="mt-1 font-mono text-xl text-parchment tnum">$1.50</div>
          </div>
          <div>
            <div className="text-[0.62rem] uppercase tracking-[0.14em] text-faint">You&apos;re covered for</div>
            <div className="mt-1 font-display text-[2rem] leading-none text-verdigris tnum">$14.40</div>
          </div>
        </div>

        <p className="mt-6 text-sm leading-relaxed text-muted">
          On an <span className="text-parchment tnum">$18</span> job with{' '}
          <span className="font-mono text-parchment">marlowe.agent</span>. If the job is not delivered,
          Lloyd pays you the <span className="text-parchment tnum">$14.40</span>, automatically.
        </p>

        <div className="mt-6 flex items-center gap-3 border-t border-hairline pt-5">
          <WaxSeal size={40} />
          <div className="leading-tight">
            <div className="font-display text-base text-verdigris">Bound</div>
            <div className="text-xs text-faint">Coverage active on bind</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
