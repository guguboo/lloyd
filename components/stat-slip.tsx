import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** A frosted policy slip carrying one live figure. Not an identical-card grid: callers vary size and weight. */
export function StatSlip({
  label,
  value,
  sub,
  className,
  children,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn('glass flex flex-col gap-2 p-5', className)}>
      <span className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-faint">
        {label}
      </span>
      <div className="font-display text-3xl leading-none text-parchment tnum sm:text-4xl">
        {value}
      </div>
      {sub && <span className="text-sm text-muted">{sub}</span>}
      {children}
    </div>
  );
}

/** Utilization against the 50% pool cap. Full bar = the cap; the fill is how close Lloyd runs to it. */
export function UtilizationMeter({ ratio, cap = 0.5 }: { ratio: number; cap?: number }) {
  const fill = Math.max(0, Math.min(ratio / cap, 1));
  const nearCap = fill >= 0.85;
  return (
    <div className="mt-1 flex flex-col gap-1.5">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[oklch(0.85_0.02_250/0.12)]">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-700',
            nearCap ? 'bg-terracotta' : 'bg-verdigris',
          )}
          style={{ width: `${fill * 100}%` }}
        />
      </div>
      <span className="text-xs text-faint tnum">
        {(ratio * 100).toFixed(1)}% drawn · cap {cap * 100}% of pool
      </span>
    </div>
  );
}
