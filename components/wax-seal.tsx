import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * The Lloyd mark — the liquid-metal monogram. Source art is a black mark on
 * white; `invert` + `mix-blend-screen` renders it as a white mark that melts
 * into any dark surface. Used once or twice, never as chrome.
 */
export function WaxSeal({ size = 56, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/lloyd-mark.png"
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={cn('select-none invert mix-blend-screen', className)}
    />
  );
}
