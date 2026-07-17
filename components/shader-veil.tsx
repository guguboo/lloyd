'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

let webglSupport: boolean | null = null;
function hasWebgl(): boolean {
  if (webglSupport !== null) return webglSupport;
  try {
    const canvas = document.createElement('canvas');
    webglSupport = !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

/**
 * Backdrop discipline for every paper-shaders background: mount the shader only
 * when the section is near the viewport, drop to a static gradient when the user
 * prefers reduced motion or WebGL is unavailable. Keeps at most the on-screen
 * shader running (the hero's LiquidMetal is the other GPU tenant).
 */
export function ShaderVeil({
  children,
  fallbackClassName,
  className,
}: {
  children: ReactNode;
  fallbackClassName?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { margin: '600px 0px 600px 0px' });
  const reduce = useReducedMotion();
  const [canShade, setCanShade] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setCanShade(hasWebgl()));
    return () => cancelAnimationFrame(id);
  }, []);

  const live = near && !reduce && canShade;
  return (
    <div ref={ref} aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {live ? children : <div className={cn('absolute inset-0', fallbackClassName)} />}
    </div>
  );
}
