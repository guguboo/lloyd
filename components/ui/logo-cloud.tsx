import { InfiniteSlider } from '@/components/ui/infinite-slider';
import { cn } from '@/lib/utils';

type Logo = {
  alt: string;
  /** SVG/image source. Omit to render `text` as a wordmark instead. */
  src?: string;
  /** Text wordmark fallback for brands without a hosted SVG (OKX.AI, viem…). */
  text?: string;
  /** Rendered next to `src` for marks that need their name spelled out (X Layer). */
  label?: string;
  width?: number;
  height?: number;
};

type LogoCloudProps = React.ComponentProps<'div'> & {
  logos: Logo[];
};

export function LogoCloud({ className, logos, ...props }: LogoCloudProps) {
  return (
    <div
      {...props}
      className={cn(
        'overflow-hidden py-4 [mask-image:linear-gradient(to_right,transparent,black,transparent)]',
        className,
      )}
    >
      <InfiniteSlider gap={56} reverse duration={48} durationOnHover={110}>
        {logos.map((logo) =>
          logo.src ? (
            <span key={`logo-${logo.alt}`} className="pointer-events-none flex select-none items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={logo.alt}
                className="h-4 brightness-0 invert opacity-60 md:h-5"
                height={logo.height || 'auto'}
                loading="lazy"
                src={logo.src}
                width={logo.width || 'auto'}
              />
              {logo.label ? (
                <span className="whitespace-nowrap text-sm font-semibold uppercase tracking-[0.18em] text-parchment/60 md:text-base">
                  {logo.label}
                </span>
              ) : null}
            </span>
          ) : (
            <span
              key={`logo-${logo.alt}`}
              className="pointer-events-none select-none whitespace-nowrap text-sm font-semibold uppercase tracking-[0.18em] text-parchment/60 md:text-base"
            >
              {logo.text ?? logo.alt}
            </span>
          ),
        )}
      </InfiniteSlider>
    </div>
  );
}
