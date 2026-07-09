import { cn } from '@/lib/utils';

/** A live pulse: the settlement watcher is awake. */
export function StatusDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('live-dot inline-block h-2 w-2 shrink-0 rounded-full bg-verdigris-lit', className)}
    />
  );
}
