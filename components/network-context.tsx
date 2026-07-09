'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Network } from '@/lib/chain';

// One shared Test/Live network selection for the whole ledger: the navbar switch sets
// it, the pool card and tables read it. Lives here so those siblings share state.
const Ctx = createContext<{ network: Network; setNetwork: (n: Network) => void } | null>(null);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [network, setNetwork] = useState<Network>('testnet');
  return <Ctx.Provider value={{ network, setNetwork }}>{children}</Ctx.Provider>;
}

export function useNetwork() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useNetwork must be used inside <NetworkProvider>');
  return v;
}
