'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

const EASE = [0.16, 1, 0.3, 1] as const;

export type RevealVariant = 'rise' | 'fall' | 'scale' | 'blur' | 'left' | 'right';

const V: Record<RevealVariant, Variants> = {
  rise: { hidden: { opacity: 0, y: 26 }, show: { opacity: 1, y: 0 } },
  fall: { hidden: { opacity: 0, y: -22 }, show: { opacity: 1, y: 0 } },
  scale: { hidden: { opacity: 0, scale: 0.93 }, show: { opacity: 1, scale: 1 } },
  blur: { hidden: { opacity: 0, filter: 'blur(12px)' }, show: { opacity: 1, filter: 'blur(0px)' } },
  left: { hidden: { opacity: 0, x: -44 }, show: { opacity: 1, x: 0 } },
  right: { hidden: { opacity: 0, x: 44 }, show: { opacity: 1, x: 0 } },
};

/** Scroll-triggered reveal with a chosen motion. Each section picks a different variant. */
export function Reveal({
  children,
  variant = 'rise',
  delay = 0,
  duration = 0.7,
  amount = 0.25,
  className,
}: {
  children: ReactNode;
  variant?: RevealVariant;
  delay?: number;
  duration?: number;
  amount?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={V[variant]}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
      transition={{ duration, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Stagger a set of children into view. Pair with <StaggerItem>. */
export function StaggerReveal({
  children,
  className,
  stagger = 0.09,
  amount = 0.2,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  amount?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
      variants={{ show: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  variant = 'rise',
  className,
}: {
  children: ReactNode;
  variant?: RevealVariant;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={V[variant]} transition={{ duration: 0.6, ease: EASE }}>
      {children}
    </motion.div>
  );
}
