// Onchain settlement lives on X Layer. The Ledger can show either network's real,
// verifiable data: the testnet dev treasury (live demo payouts) or the mainnet
// OKX Agentic Wallet (Lloyd's production identity). Both link to OKLink.
export type Network = 'testnet' | 'mainnet';

export const EXPLORERS: Record<Network, string> = {
  testnet: 'https://www.oklink.com/x-layer-testnet',
  mainnet: 'https://www.oklink.com/xlayer',
};

export const TREASURY: Record<Network, { address: string; label: string; sub: string }> = {
  testnet: {
    address: '0x46a9B8e932c71ca24d5667f08D1B3FE6861931e4',
    label: 'Testnet treasury',
    sub: 'X Layer testnet · real demo payouts',
  },
  mainnet: {
    address: '0xbf5698cfe8b3a4bc803951642e87b0db07b7be3f',
    label: 'OKX Agentic Wallet',
    sub: 'X Layer mainnet · production identity',
  },
};

export const txUrl = (net: Network, hash: string) => `${EXPLORERS[net]}/tx/${hash}`;
export const addressUrl = (net: Network, addr: string) => `${EXPLORERS[net]}/address/${addr}`;
