'use client';

import Link from 'next/link';
import { LiquidMetal } from '@paper-design/shaders-react';
import { ShaderVeil } from '@/components/shader-veil';
import { useReducedMotion, motion, type Variants } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Magnetic } from '@/components/magnetic';
import { LogoCloud } from '@/components/ui/logo-cloud';

interface HeroLogo {
  alt: string;
  src?: string;
  text?: string;
}

interface LiquidMetalHeroProps {
  badge?: string;
  title: string;
  subtitle: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  features?: string[];
  logos?: HeroLogo[];
}

const EASE = [0.25, 0.1, 0.25, 1] as const;

const rise = (delay: number): Variants => ({
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE, delay } },
});

export default function LiquidMetalHero({
  badge,
  title,
  subtitle,
  primaryCtaLabel,
  primaryCtaHref,
  secondaryCtaLabel,
  secondaryCtaHref,
  features = [],
  logos = [],
}: LiquidMetalHeroProps) {
  const reduce = useReducedMotion();
  const anim = (delay: number) =>
    reduce
      ? {}
      : ({ variants: rise(delay), initial: 'hidden', animate: 'show' } as const);

  return (
    <section className="relative left-1/2 flex min-h-[92svh] w-screen -translate-x-1/2 flex-col justify-center overflow-hidden px-6 py-16">
      {/* molten chrome — the wax seal gone liquid. Veiled so the GPU is
          released once the hero scrolls out; maxPixelCount caps the render
          target on high-DPI screens (same discipline as the closing blob). */}
      <ShaderVeil
        className="z-0"
        fallbackClassName="bg-[radial-gradient(ellipse_65%_60%_at_50%_42%,#17191d_0%,#0b0c0e_78%)]"
      >
        <LiquidMetal
          className="absolute inset-0 h-full w-full"
          colorBack="#0b0c0e"
          colorTint="#e8eaef"
          shape="diamond"
          scale={0.82}
          softness={0.35}
          repetition={2}
          shiftRed={0.25}
          shiftBlue={0.35}
          distortion={0.06}
          contour={0.5}
          angle={72}
          speed={0.55}
          maxPixelCount={1_200_000}
        />
      </ShaderVeil>
      {/* legibility veil + grain over the shader */}
      <div
        aria-hidden
        className="absolute inset-0 z-[1] bg-[radial-gradient(ellipse_60%_60%_at_50%_42%,rgba(9,10,12,0.30)_0%,rgba(9,10,12,0.62)_62%,rgba(9,10,12,0.94)_100%)]"
      />
      <div aria-hidden className="grain absolute inset-0 z-[2]" />

      <div className="relative z-10 mx-auto w-full max-w-[1080px]">
        <div className="space-y-8 text-center">
          {badge && (
            <motion.div className="flex justify-center" {...anim(0.15)}>
              <Badge
                variant="secondary"
                className="border-parchment/20 bg-parchment/10 px-4 py-1.5 text-[0.7rem] uppercase tracking-[0.2em] text-parchment backdrop-blur-sm transition-colors duration-300 hover:bg-parchment/20"
              >
                {badge}
              </Badge>
            </motion.div>
          )}

          <div className="space-y-6">
            <motion.h1
              className="mx-auto max-w-[16ch] font-display text-5xl leading-[1.04] tracking-tight text-parchment [text-shadow:0_2px_24px_rgba(9,10,12,0.8)] sm:text-6xl lg:text-7xl"
              {...anim(0.3)}
            >
              {title}
            </motion.h1>

            <motion.p
              className="mx-auto max-w-[52ch] text-lg leading-relaxed text-parchment/85 [text-shadow:0_1px_12px_rgba(9,10,12,0.9)] sm:text-xl"
              {...anim(0.45)}
            >
              {subtitle}
            </motion.p>
          </div>

          <motion.div
            className="flex flex-col items-center justify-center gap-4 sm:flex-row"
            {...anim(0.6)}
          >
            <Magnetic>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  asChild
                  size="lg"
                  className="rounded-full bg-parchment px-8 py-6 text-base font-semibold text-ink shadow-2xl transition-all duration-300 hover:bg-parchment/90"
                >
                  <Link href={primaryCtaHref}>{primaryCtaLabel}</Link>
                </Button>
              </motion.div>
            </Magnetic>

            {secondaryCtaLabel && secondaryCtaHref && (
              <Magnetic>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="rounded-full border-parchment/30 bg-ink/55 px-8 py-6 text-base font-semibold text-parchment backdrop-blur-md transition-all duration-300 hover:border-parchment/50 hover:bg-ink/70"
                  >
                    <Link href={secondaryCtaHref}>{secondaryCtaLabel}</Link>
                  </Button>
                </motion.div>
              </Magnetic>
            )}
          </motion.div>

          {features.length > 0 && (
            <motion.div className="pt-6" {...anim(0.75)}>
              <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.3 }}>
                <Card className="border-parchment/15 bg-ink/40 shadow-2xl backdrop-blur-md">
                  <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-3 sm:gap-6">
                    {features.map((feature) => (
                      <p
                        key={feature}
                        className="text-center text-sm font-medium text-parchment/90 sm:text-base"
                      >
                        {feature}
                      </p>
                    ))}
                  </div>
                </Card>
              </motion.div>
            </motion.div>
          )}

          {logos.length > 0 && (
            <motion.div className="pt-2" {...anim(0.9)}>
              <p className="mb-1 text-[0.65rem] uppercase tracking-[0.24em] text-parchment/50">
                Built on
              </p>
              <div className="mx-auto h-px max-w-sm bg-parchment/15 [mask-image:linear-gradient(to_right,transparent,black,transparent)]" />
              <LogoCloud logos={logos} />
              <div className="mx-auto h-px max-w-sm bg-parchment/15 [mask-image:linear-gradient(to_right,transparent,black,transparent)]" />
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
