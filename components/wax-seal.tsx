import { cn } from '@/lib/utils';

/**
 * The Lloyd mark: an engraved seal, the way a policy was once made binding.
 * Double ring, a milled edge, a maritime anchor. Colored by `currentColor`
 * (set text-brass on the caller). Used once or twice, never as chrome.
 */
export function WaxSeal({ size = 56, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden
      className={cn('text-brass', className)}
    >
      <circle cx="50" cy="50" r="47" stroke="currentColor" strokeWidth="1.4" opacity="0.9" />
      <circle cx="50" cy="50" r="40.5" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      {/* milled edge, faked with a dashed ring */}
      <circle
        cx="50"
        cy="50"
        r="43.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeDasharray="0.6 4.2"
        strokeLinecap="round"
        opacity="0.55"
      />
      {/* anchor */}
      <g stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="50" cy="31" r="4.2" />
        <path d="M50 35.5 V66" />
        <path d="M40.5 43.5 H59.5" />
        <path d="M35 57 Q37.5 67.5 50 67.5 Q62.5 67.5 65 57" fill="none" />
        <path d="M35 57 l-3.4 1.6 M35 57 l1.9 3.4" />
        <path d="M65 57 l3.4 1.6 M65 57 l-1.9 3.4" />
      </g>
    </svg>
  );
}
