'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { WaxSeal } from '@/components/wax-seal';
import { cn } from '@/lib/utils';

/** The mark, stamped: presses in like a seal into wax. */
export function SealStamp({ size = 120, className }: { size?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <WaxSeal size={size} className={className} />;
  return (
    <motion.span
      className={cn('inline-block', className)}
      initial={{ scale: 1.6, rotate: -14, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 17 }}
    >
      <WaxSeal size={size} />
    </motion.span>
  );
}
