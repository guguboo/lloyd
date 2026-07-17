'use client';

import { GrainGradient } from '@paper-design/shaders-react';
import { ShaderVeil } from '@/components/shader-veil';

/** Quiet grain wash behind a subpage header — landing-grade atmosphere, no noise. */
export function PageWash() {
  return (
    <ShaderVeil
      className="h-[60vh] [mask-image:linear-gradient(to_bottom,#000_0%,transparent_95%)]"
      fallbackClassName="bg-[radial-gradient(ellipse_70%_80%_at_50%_-10%,oklch(0.22_0.015_250)_0%,transparent_70%)]"
    >
      <GrainGradient
        className="absolute inset-0 h-full w-full"
        colorBack="#101216"
        colors={['#2c3642', '#46586a', '#748ba1']}
        softness={0.8}
        intensity={0.28}
        noise={0.35}
        speed={0.35}
        shape="corners"
      />
    </ShaderVeil>
  );
}
