// components/connect-key.tsx
'use client';

import { useState } from 'react';
import { Check, Loader2, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CopyButton } from '@/components/copy-button';

declare global {
  interface Window {
    ethereum?: { request(args: { method: string; params?: unknown[] }): Promise<unknown> };
  }
}

const issuanceMessage = (wallet: string, issuedAt: string) =>
  `Lloyd API key issuance\nwallet: ${wallet.toLowerCase()}\nissued: ${issuedAt}`;

const toHex = (s: string) =>
  '0x' + Array.from(new TextEncoder().encode(s), (b) => b.toString(16).padStart(2, '0')).join('');

type Phase = 'idle' | 'connecting' | 'signing' | 'submitting' | 'done';

export function ConnectKey() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const busy = phase === 'connecting' || phase === 'signing' || phase === 'submitting';

  async function connect() {
    setError(null);
    if (!window.ethereum) { setError('No wallet found. Install MetaMask and reload.'); return; }
    setPhase('connecting');
    try {
      const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      setWallet(accounts[0] ?? null);
      setPhase('idle');
    } catch {
      setError('Wallet connection was rejected.');
      setPhase('idle');
    }
  }

  async function issue() {
    if (!wallet || !window.ethereum) return;
    setError(null);
    setPhase('signing');
    try {
      const issuedAt = new Date().toISOString();
      const signature = (await window.ethereum.request({
        method: 'personal_sign',
        params: [toHex(issuanceMessage(wallet, issuedAt)), wallet],
      })) as string;
      setPhase('submitting');
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ wallet, signature, issued_at: issuedAt }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error === 'rate_limited' ? 'Too many attempts — try again later.' : 'Issuance failed — sign with the connected wallet and retry.');
        setPhase('idle');
        return;
      }
      setApiKey(data.api_key);
      setPhase('done');
    } catch {
      setError('Signing was rejected or failed.');
      setPhase('idle');
    }
  }

  if (phase === 'done' && apiKey) {
    return (
      <div className="glass-quiet p-6">
        <p className="flex items-center gap-2.5 text-verdigris">
          <Check size={18} strokeWidth={2} />
          <span className="font-display text-lg">Your API key — shown once, copy it now.</span>
        </p>
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-hairline px-4 py-3">
          <code className="overflow-x-auto font-mono text-sm text-parchment">{apiKey}</code>
          <CopyButton value={apiKey} />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-faint">
          Send it as <code className="font-mono">Authorization: Bearer &lt;key&gt;</code> to the full
          MCP endpoint. It can only bind coverage paying {wallet?.slice(0, 6)}…{wallet?.slice(-4)} — a
          leaked key cannot redirect payouts.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-quiet p-6">
      <div className="flex flex-wrap items-center gap-3">
        {wallet ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-verdigris/40 px-4 py-2 font-mono text-xs text-verdigris">
            <Wallet size={13} strokeWidth={1.8} />
            {wallet.slice(0, 6)}…{wallet.slice(-4)}
          </span>
        ) : (
          <button
            type="button"
            onClick={connect}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full border border-hairline px-5 py-2.5 text-sm text-muted transition-colors hover:border-verdigris/40 hover:text-parchment disabled:opacity-50"
          >
            {phase === 'connecting' ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} strokeWidth={1.8} />}
            Connect wallet
          </button>
        )}
        <button
          type="button"
          onClick={issue}
          disabled={!wallet || busy}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm transition-colors',
            wallet && !busy ? 'bg-verdigris text-ink hover:bg-verdigris-lit' : 'border border-hairline text-faint',
          )}
        >
          {(phase === 'signing' || phase === 'submitting') && <Loader2 size={14} className="animate-spin" />}
          {phase === 'signing' ? 'Sign in your wallet…' : phase === 'submitting' ? 'Issuing…' : 'Sign & get API key'}
        </button>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-faint">
        Signing is free — no transaction, no gas. The key is bound to your wallet: it can only buy
        coverage that pays you.
      </p>
      {error && <p className="mt-3 text-sm text-brass">{error}</p>}
    </div>
  );
}
