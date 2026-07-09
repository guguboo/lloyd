// scripts/testnet-wallet.ts
// Generates Lloyd's throwaway X Layer testnet treasury wallet if TESTNET_PRIVATE_KEY
// is not already in the env, appends the key to .env.local (gitignored), and prints
// ONLY the public address. The key never touches stdout.
// Run: ./node_modules/.bin/tsx --env-file=.env.local scripts/testnet-wallet.ts
import { appendFileSync } from 'node:fs';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const existing = process.env.TESTNET_PRIVATE_KEY as `0x${string}` | undefined;
const pk = existing ?? generatePrivateKey();
const account = privateKeyToAccount(pk);

if (!existing) {
  appendFileSync('.env.local', `\nTESTNET_PRIVATE_KEY=${pk}\n`);
  console.log('Generated new testnet treasury wallet, key saved to .env.local');
}
console.log('ADDRESS=' + account.address);
