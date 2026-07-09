'use client';

import { useEffect, useRef } from 'react';

/**
 * Numbers count up on load: the live-books feeling. 900ms, ease-out-expo.
 * Writes textContent via rAF instead of setState — no React re-render per frame,
 * no motion lib. SSR renders 0 (matching the animation's from-state).
 */
export function CountUp({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fmt = (n: number) =>
      `${prefix}${n.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}${suffix}`;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = fmt(value);
      return;
    }
    const start = performance.now();
    let raf = requestAnimationFrame(function tick(now: number) {
      const t = Math.min((now - start) / 900, 1);
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t); // ease-out-expo
      el.textContent = fmt(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [value, decimals, prefix, suffix]);

  const zero = (0).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span ref={ref} className={className}>
      {prefix}
      {zero}
      {suffix}
    </span>
  );
}
