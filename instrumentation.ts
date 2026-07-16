// Next.js runs this once at server startup. Validate env here so a misconfigured deploy
// fails fast and loud (M-3) rather than on the first money-moving request.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { validateEnv } = await import('./lib/env');
  validateEnv();
}
