'use client';

import { useEffect, useRef } from 'react';

/**
 * The room is alive: three verdigris aurora blobs drift slowly behind the grid,
 * and a faint candle-glow follows the pointer. Fixed, behind all content, inert
 * to input. Stills entirely under prefers-reduced-motion.
 */
export function Ambient() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const onMove = (e: PointerEvent) => {
      el.style.setProperty('--mx', `${e.clientX}px`);
      el.style.setProperty('--my', `${e.clientY}px`);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  return (
    <div ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="aurora-blob drift-1"
        style={{ top: '-12%', left: '-6%', width: '46vw', height: '46vw', background: 'radial-gradient(circle, oklch(0.72 0.11 175 / 0.16), transparent 70%)' }}
      />
      <div
        className="aurora-blob drift-2"
        style={{ top: '26%', right: '-12%', width: '40vw', height: '40vw', background: 'radial-gradient(circle, oklch(0.60 0.10 210 / 0.14), transparent 70%)' }}
      />
      <div
        className="aurora-blob drift-3"
        style={{ bottom: '-18%', left: '22%', width: '42vw', height: '42vw', background: 'radial-gradient(circle, oklch(0.70 0.09 160 / 0.12), transparent 70%)' }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(340px circle at var(--mx, 50%) var(--my, 25%), oklch(0.72 0.11 175 / 0.06), transparent 70%)' }}
      />
    </div>
  );
}
