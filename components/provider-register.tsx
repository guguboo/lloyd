'use client';

import { useState } from 'react';
import { Check, Loader2, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

// The provider entry point: connect a wallet, sign the registration message, listed.
// Raw window.ethereum keeps this dependency-free; any injected wallet works.
declare global {
  interface Window {
    ethereum?: { request(args: { method: string; params?: unknown[] }): Promise<unknown> };
  }
}

const registrationMessage = (providerId: string, wallet: string) =>
  `Lloyd provider registration\nprovider: ${providerId}\nwallet: ${wallet.toLowerCase()}`;

const toHex = (s: string) =>
  '0x' + Array.from(new TextEncoder().encode(s), (b) => b.toString(16).padStart(2, '0')).join('');

type Phase = 'idle' | 'connecting' | 'signing' | 'submitting' | 'done';

export function ProviderRegister() {
  const [providerId, setProviderId] = useState('');
  const [wallet, setWallet] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ provider_id: string; terms?: string } | null>(null);

  const idOk = /^[a-z0-9][a-z0-9._:-]*$/.test(providerId) && providerId.length >= 3 && providerId.length <= 60;
  const busy = phase === 'connecting' || phase === 'signing' || phase === 'submitting';

  async function connect() {
    setError(null);
    if (!window.ethereum) {
      setError('No wallet found. Install MetaMask (or any injected wallet) and reload.');
      return;
    }
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

  async function register() {
    if (!wallet || !idOk || !window.ethereum) return;
    setError(null);
    setPhase('signing');
    try {
      const message = registrationMessage(providerId, wallet);
      const signature = (await window.ethereum.request({
        method: 'personal_sign',
        params: [toHex(message), wallet],
      })) as string;

      setPhase('submitting');
      const res = await fetch('/api/providers/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider_id: providerId, wallet, signature }),
      });
      const data = await res.json();
      if (!data.ok) {
        const msgs: Record<string, string> = {
          provider_id_taken: 'That provider id is already registered to a different wallet.',
          wallet_already_registered: 'This wallet is already registered under another provider id.',
          invalid_signature: 'Signature did not verify — make sure you signed with the connected wallet.',
          rate_limited: 'Too many attempts from this address. Try again later.',
        };
        setError(msgs[data.error] ?? 'Registration failed. Please try again.');
        setPhase('idle');
        return;
      }
      setResult({ provider_id: data.provider_id, terms: data.terms });
      setPhase('done');
    } catch {
      setError('Signing was rejected or failed.');
      setPhase('idle');
    }
  }

  if (phase === 'done' && result) {
    return (
      <div className="glass-quiet p-6">
        <p className="flex items-center gap-2.5 text-verdigris">
          <Check size={18} strokeWidth={2} />
          <span className="font-display text-lg">Registered — you are now insurable.</span>
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Buyers can now quote and bind coverage against{' '}
          <code className="font-mono text-parchment">{result.provider_id}</code>.
          {result.terms ? ` ${result.terms}` : ''} Attest your deliveries (below) to build the record
          that lifts your caps and lowers your buyers&rsquo; premiums.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-quiet p-6">
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-[0.16em] text-faint">Provider id</span>
          <input
            value={providerId}
            onChange={(e) => setProviderId(e.target.value.toLowerCase())}
            placeholder="okx:agent:yourname"
            spellCheck={false}
            className="rounded-lg border border-hairline bg-transparent px-4 py-3 font-mono text-sm text-parchment placeholder:text-faint/60 focus:border-verdigris/50 focus:outline-none"
          />
          {providerId && !idOk && (
            <span className="text-xs text-brass">3–60 chars: lowercase letters, digits, <code>. _ : -</code></span>
          )}
        </label>

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
            onClick={register}
            disabled={!wallet || !idOk || busy}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm transition-colors',
              wallet && idOk && !busy
                ? 'bg-verdigris text-ink hover:bg-verdigris-lit'
                : 'border border-hairline text-faint',
            )}
          >
            {(phase === 'signing' || phase === 'submitting') && <Loader2 size={14} className="animate-spin" />}
            {phase === 'signing' ? 'Sign in your wallet…' : phase === 'submitting' ? 'Registering…' : 'Sign & register'}
          </button>
        </div>

        <p className="text-xs leading-relaxed text-faint">
          Signing is free — no transaction, no gas. The wallet you register is the address buyers&rsquo;
          job payments are verified against and the key you&rsquo;ll attest deliveries with.
        </p>

        {error && <p className="text-sm text-brass">{error}</p>}
      </div>
    </div>
  );
}
