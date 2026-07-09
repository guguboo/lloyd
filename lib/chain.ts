// X Layer (chain 196) block explorer. Policies settle and pay out here; the
// Ledger links every row to its onchain counterpart so anyone can verify.
export const EXPLORER = 'https://www.oklink.com/xlayer';
export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (addr: string) => `${EXPLORER}/address/${addr}`;
