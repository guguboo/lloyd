'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PulsingBorder } from '@paper-design/shaders-react';
import { useInView, useReducedMotion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { UNDERWRITING_SCRIPT, stepEndTimes, type ConsoleStep } from '@/lib/console-script';
import { SealStamp } from '@/components/seal-stamp';
import { cn } from '@/lib/utils';

const MS_PER_CHAR = 18;

function lineClass(kind: ConsoleStep['kind']): string {
  switch (kind) {
    case 'cmd': return 'text-parchment';
    case 'out': return 'text-muted';
    case 'event': return 'text-faint';
    case 'seal': return 'text-verdigris';
    case 'payout': return 'text-verdigris-lit';
  }
}

function prompt(kind: ConsoleStep['kind']): string {
  if (kind === 'cmd') return '❯ ';
  if (kind === 'event') return '· ';
  return '';
}

/**
 * One insured job, replayed as a live MCP session. Pure fixture data
 * (lib/console-script.ts) — works offline, deterministic, replayable.
 */
export default function UnderwritingConsole() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4, once: true });
  const reduce = useReducedMotion();
  const [elapsed, setElapsed] = useState(0);
  const [runId, setRunId] = useState(0);

  const ends = useMemo(() => stepEndTimes(UNDERWRITING_SCRIPT, MS_PER_CHAR), []);
  const total = ends[ends.length - 1];
  const playing = inView && !reduce && elapsed < total;
  const done = reduce || elapsed >= total;

  useEffect(() => {
    if (!inView || reduce) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = now - start;
      setElapsed(t);
      if (t < total) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce, total, runId]);

  const skip = () => setElapsed(total);
  const replay = () => { setElapsed(0); setRunId((n) => n + 1); };

  return (
    <div ref={ref} className="relative" onClick={playing ? skip : undefined}>
      {playing && (
        <PulsingBorder
          className="pointer-events-none absolute -inset-2 h-[calc(100%+16px)] w-[calc(100%+16px)]"
          colorBack="#00000000"
          colors={['#9fb4c6', '#e4eaf3']}
          roundness={0.08}
          thickness={0.03}
          intensity={0.18}
          bloom={0.3}
          pulse={0.35}
          smoke={0.15}
          speed={1}
        />
      )}
      <div className="glass-quiet relative overflow-hidden rounded-xl border border-hairline">
        <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
          <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-faint">
            lloyd · mcp session — one insured job
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); replay(); }}
            className="flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-parchment"
            aria-label="Replay session"
          >
            <RotateCcw size={13} /> replay
          </button>
        </div>
        <div aria-live="polite" className="min-h-[290px] px-5 py-4 font-mono text-[0.83rem] leading-7">
          {UNDERWRITING_SCRIPT.map((step, i) => {
            const stepStart = i === 0 ? 0 : ends[i - 1];
            if (!done && elapsed < stepStart) return null;
            const typedChars =
              step.kind === 'cmd' || step.kind === 'out'
                ? Math.min(step.text.length, Math.floor((elapsed - stepStart) / MS_PER_CHAR))
                : step.text.length;
            const text = done ? step.text : step.text.slice(0, typedChars);
            if (step.kind === 'seal') {
              return (
                <div key={`${runId}-${step.id}`} className="my-2 flex items-center gap-3">
                  <SealStamp size={30} />
                  <span className={lineClass(step.kind)}>{text}</span>
                </div>
              );
            }
            return (
              <div key={`${runId}-${step.id}`} className={cn('whitespace-pre-wrap break-all', lineClass(step.kind))}>
                {prompt(step.kind)}{text}
              </div>
            );
          })}
          {!done && <span className="inline-block h-4 w-2 animate-pulse bg-verdigris align-middle" />}
        </div>
        {!done && (
          <div className="border-t border-hairline px-4 py-2 text-center text-[0.68rem] uppercase tracking-[0.14em] text-faint">
            click to skip
          </div>
        )}
      </div>
    </div>
  );
}
