import { z } from 'zod';

// Fail fast on a misconfigured deploy (M-3): validated once at server boot via
// instrumentation.ts, so a missing/blank var errors loudly at startup instead of on the
// first quote, payout, or cron. Mode-specific secrets are required only in the mode that
// moves money.
const baseSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  LLOYD_MODE: z.enum(['fixture', 'testnet', 'real']).default('fixture'),
});

export function validateEnv(env: Record<string, string | undefined> = process.env) {
  const base = baseSchema.safeParse(env);
  if (!base.success) {
    throw new Error(`Invalid environment: ${JSON.stringify(base.error.flatten().fieldErrors)}`);
  }
  const mode = base.data.LLOYD_MODE;
  const missing: string[] = [];
  if (mode !== 'fixture' && !env.LLOYD_API_KEY) missing.push('LLOYD_API_KEY (public endpoint auth required off fixture mode)');
  if (mode === 'testnet' && !env.TESTNET_PRIVATE_KEY) missing.push('TESTNET_PRIVATE_KEY (testnet settlement signer)');
  if (missing.length) throw new Error(`LLOYD_MODE=${mode} requires: ${missing.join('; ')}`);
  return base.data;
}
