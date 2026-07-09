'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Copy-to-clipboard control for the code blocks on /build.
 * Shows a verdigris check for ~1.5s after a successful copy, then reverts.
 */
export function CopyButton({
  value,
  className,
  label = 'Copy',
}: {
  value: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (insecure context or denied permission): stay quiet.
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={copied ? 'Copied' : label}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-md border border-hairline px-2.5 py-1 font-mono text-[0.7rem] text-muted transition-colors hover:border-verdigris/40 hover:text-parchment',
        copied && 'border-verdigris/40 text-verdigris',
        className,
      )}
    >
      {copied ? (
        <Check size={13} strokeWidth={1.9} />
      ) : (
        <Copy size={13} strokeWidth={1.7} />
      )}
      {copied ? 'Copied' : label}
    </button>
  );
}
