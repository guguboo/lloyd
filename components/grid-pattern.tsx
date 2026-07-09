import { cn } from '@/lib/utils';

/**
 * A faint maritime chart-rule grid, drawn in hairline verdigris.
 * Sits behind the room as wallpaper; masked to fade at the edges by the caller.
 * Pure SVG (no hooks) so it renders in Server Components.
 */
export function GridPattern({
  size = 44,
  className,
  id = 'lloyd-grid',
}: {
  size?: number;
  className?: string;
  id?: string;
}) {
  return (
    <svg
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
    >
      <defs>
        <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse">
          <path
            d={`M ${size} 0 L 0 0 0 ${size}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
