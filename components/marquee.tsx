'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Lloyd's List: a slow ticker of recent underwriting, the way the original
 * coffee-house list carried shipping news. Duplicated track for a seamless loop;
 * pauses on hover; stills under prefers-reduced-motion.
 */
export function Marquee({
  items,
  durationSec = 46,
  className,
}: {
  items: ReactNode[];
  durationSec?: number;
  className?: string;
}) {
  return (
    <div className={cn('marquee', className)}>
      <div
        className="marquee-track"
        style={{ ['--marquee-duration' as string]: `${durationSec}s` }}
      >
        {items.map((item, i) => (
          <span key={`a-${i}`} className="inline-flex items-center">
            {item}
          </span>
        ))}
        {items.map((item, i) => (
          <span key={`b-${i}`} aria-hidden className="inline-flex items-center">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
