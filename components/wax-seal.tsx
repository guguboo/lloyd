import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * The Lloyd mark — the liquid-metal monogram. The asset is a parchment-white
 * mark on a transparent background (generated from the black-on-white source
 * art), so it sits on any dark surface without blend-mode tricks — Chrome's
 * compositor intermittently dropped the old `invert` + `mix-blend-screen`
 * pair. Used once or twice, never as chrome.
 */
export function WaxSeal({ size = 56, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/lloyd-mark-alpha.png"
      alt=""
      aria-hidden
      width={size}
      height={size}
      style={{ height: 'auto' }}
      className={cn('select-none', className)}
    />
  );
}
