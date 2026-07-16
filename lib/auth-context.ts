// lib/auth-context.ts — carries the authenticated identity from the HTTP gate to the
// MCP tools without threading it through mcp-handler. Node runtime only.
import { AsyncLocalStorage } from 'node:async_hooks';

export type AuthCtx = { wallet: string | null; master: boolean };

export const authStore = new AsyncLocalStorage<AuthCtx>();

/** The authenticated wallet (lowercase), or null for master key / open endpoint / fixture. */
export const authWallet = (): string | null => authStore.getStore()?.wallet ?? null;

/** True iff a gate established ANY auth context (master or wallet). Paid tools require
 *  this: a paid registrar composed onto a route without the gate must fail closed. */
export const hasAuthContext = (): boolean => authStore.getStore() !== undefined;

/** True iff a wallet-keyed caller is trying to act for a DIFFERENT wallet. Master and
 *  unauthenticated contexts never mismatch — enforcement applies only to wallet keys. */
export function walletMismatch(target: string): boolean {
  const w = authWallet();
  // authenticateKey already lowercases, but this comparison is the money-path security
  // boundary — normalize both sides here so the invariant never depends on a caller.
  return w !== null && target.toLowerCase() !== w.toLowerCase();
}
