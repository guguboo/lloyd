'use client';

import Link from 'next/link';
import { Metaballs } from '@paper-design/shaders-react';
import { Magnetic } from '@/components/magnetic';
import { Reveal } from '@/components/reveal';
import { ShaderVeil } from '@/components/shader-veil';

/**
 * The signature — Lloyd's closing argument. Molten verdigris metaballs behind
 * a final CTA; the blob is the statement, the overlay keeps the text readable.
 */
export default function ClosingCta() {
  return (
    <section className="relative -mx-6 overflow-hidden border-t border-hairline">
      <ShaderVeil fallbackClassName="bg-[radial-gradient(ellipse_75%_90%_at_50%_100%,oklch(0.30_0.03_250)_0%,oklch(0.14_0.006_255)_70%)]">
        <Metaballs
          className="absolute inset-0 h-full w-full"
          colorBack="#101216"
          colors={['#2c3642', '#5d7080', '#9fb4c6', '#e4eaf3']}
          count={7}
          size={0.92}
          speed={0.55}
          scale={1.15}
        />
        {/* dim + fade into the footer so text stays AA-contrast */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_45%,transparent_0%,oklch(0.14_0.006_255/0.72)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-ink" />
      </ShaderVeil>

      <div className="relative mx-auto max-w-[1080px] px-6 py-24 text-center sm:py-32">
        <Reveal variant="blur">
          <p className="mb-6 text-xs uppercase tracking-[0.22em] text-verdigris">Entry VI · The signature</p>
          <h2 className="mx-auto max-w-[18ch] font-display text-4xl leading-[1.08] text-parchment sm:text-5xl">
            Hire like someone&rsquo;s standing behind the risk.
          </h2>
          <p className="mx-auto mt-6 max-w-[46ch] text-lg leading-relaxed text-muted">
            Merchants wrote their names under the risk. Lloyd writes its name under yours.
          </p>
        </Reveal>
        <Reveal variant="rise" delay={0.15}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Magnetic>
              <Link
                href="/build"
                className="inline-block rounded-full bg-parchment px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-verdigris-lit"
              >
                Connect your agent
              </Link>
            </Magnetic>
            <Magnetic>
              <Link
                href="/ledger"
                className="inline-block rounded-full border border-hairline px-6 py-3 text-sm text-parchment transition-colors hover:border-verdigris/40"
              >
                Read the Ledger
              </Link>
            </Magnetic>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
