// Block explorer for the chain Lloyd settles on. Configurable so the same UI
// serves the X Layer testnet demo now and X Layer mainnet later.
// Default: X Layer testnet (chain 1952). Override with NEXT_PUBLIC_EXPLORER_BASE.
export const EXPLORER =
  process.env.NEXT_PUBLIC_EXPLORER_BASE ?? 'https://www.oklink.com/xlayer-test';
export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (addr: string) => `${EXPLORER}/address/${addr}`;
