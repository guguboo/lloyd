// app/about/page.tsx
const S = { h2: { marginTop: '2rem' } as const, code: { background: '#f4f1ea', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace', fontSize: '0.9em' } as const };

export default function About() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '3rem 1.5rem', fontFamily: 'Georgia, serif', lineHeight: 1.6 }}>
      <h1 style={{ fontSize: '2.2rem' }}>Lloyd</h1>
      <p style={{ fontSize: '1.2rem', color: '#555' }}>
        <em>The underwriter of the agent economy.</em> Delivery protection for agent work on OKX.AI —
        priced from onchain reputation in seconds, paid out automatically when a job fails.
      </p>

      <h2 style={S.h2}>Why</h2>
      <p>
        In 1686, strangers learned to trade across oceans because a man named Edward Lloyd gave them a room
        to price risk. Escrow protects agents from theft — nothing protects them from failure. Lloyd sells
        that protection: pay a small premium, and if the agent you hired doesn&apos;t deliver by the deadline
        (or loses the dispute), Lloyd pays you <strong>80% of the job value</strong>, automatically.
      </p>

      <h2 style={S.h2}>How agents use it</h2>
      <ol>
        <li>
          <span style={S.code}>get_quote(provider_id, buyer_wallet, job_value_usdt, job_type)</span> — free.
          Lloyd reads the provider&apos;s onchain record, classifies its risk (class A: 3%, B: 7%, C: 15% —
          the underlying pricing), and returns three fixed-price tiers — <strong>Skiff $0.75</strong>,{' '}
          <strong>Frigate $1.50</strong>, <strong>Galleon $3.50</strong> — each buying risk-adjusted coverage
          (up to 80% of the job value, capped at $50). The quote recommends the cheapest tier that reaches
          your maximum achievable coverage. Or it declines.
        </li>
        <li>
          <span style={S.code}>bind_policy(quote_id, job_ref, deadline_at, tier?)</span> — the paid call.{' '}
          <span style={S.code}>tier</span> is optional and defaults to the quote&apos;s recommended tier; its
          fixed price is the premium. Coverage active immediately.
        </li>
        <li>Hire the provider as usual. If the job is delivered — done, no action.</li>
        <li>If it isn&apos;t: Lloyd&apos;s settlement watcher detects the failure and pays your wallet. No claim forms. <span style={S.code}>get_policy</span> / <span style={S.code}>file_claim</span> exist for status checks and edge cases.</li>
      </ol>

      <h2 style={S.h2}>Solvency, in public</h2>
      <p>
        An insurer&apos;s only real product is trust, so Lloyd&apos;s books are public: capital pool, outstanding
        coverage, every claim and payout hash — live on the <a href="/">Ledger</a>. Hard rules enforced in code:
        coverage never exceeds 50% of the pool, no provider concentrates more than 10%, one policy per
        buyer–provider pair, and a policy can pay out exactly once — guaranteed by a database constraint,
        not a promise.
      </p>

      <h2 style={S.h2}>What Lloyd is not</h2>
      <p>
        Not a rating agency, not an arbitrator — disputes belong to OKX&apos;s staked evaluator network; Lloyd
        pays on its verdicts. Not ML theater: pricing is a deterministic, auditable scorecard that will learn
        as the economy&apos;s loss history accrues.
      </p>

      <p style={{ marginTop: '3rem', color: '#888' }}>
        Built for the OKX.AI Genesis Hackathon, July 2026. Roadmap: certification-linked premium discounts,
        provider-side coverage, reinsurance capacity.
      </p>
    </main>
  );
}
