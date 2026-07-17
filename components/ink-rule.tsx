'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

/** A solvency rule written into the ledger: the underline draws like an ink stroke. */
export function InkRule({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <div className="flex items-start gap-3 pb-3 text-muted">
      <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-verdigris" />
      <span className="relative">
        {children}
        <svg aria-hidden className="absolute -bottom-2 left-0 h-[3px] w-full" viewBox="0 0 100 2" preserveAspectRatio="none">
          <motion.line
            x1="0" y1="1" x2="100" y2="1"
            stroke="oklch(0.82 0.022 250 / 0.45)" strokeWidth="1.5"
            initial={reduce ? undefined : { pathLength: 0 }}
            whileInView={reduce ? undefined : { pathLength: 1 }}
            viewport={{ once: true, amount: 1 }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
          />
        </svg>
      </span>
    </div>
  );
}
