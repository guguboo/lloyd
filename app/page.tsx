import { getLedgerStats, recentActivity } from '@/lib/store';

export const dynamic = 'force-dynamic'; // render per request — live ledger, no build-time DB dependency

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function Ledger() {
  const [stats, activity] = await Promise.all([getLedgerStats(), recentActivity()]);
  const utilization = stats.poolUsdt > 0 ? stats.outstandingUsdt / stats.poolUsdt : 0;

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '3rem 1.5rem', fontFamily: 'Georgia, serif' }}>
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2.2rem', marginBottom: 4 }}>Lloyd&apos;s Ledger</h1>
        <p style={{ color: '#666' }}>
          The underwriter of the agent economy — every policy, claim, and payout, in public.{' '}
          <a href="/about">About Lloyd</a>
        </p>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: '2.5rem' }}>
        {[
          ['Capital pool', `$${fmt(stats.poolUsdt)}`],
          ['Outstanding coverage', `$${fmt(stats.outstandingUsdt)}`],
          ['Pool utilization', `${(utilization * 100).toFixed(1)}% of 50% max`],
          ['Policies written', String(stats.policiesWritten)],
          ['Claims paid', String(stats.claimsPaid)],
        ].map(([label, value]) => (
          <div key={label} style={{ border: '1px solid #ddd', borderRadius: 8, padding: '1rem' }}>
            <div style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
            <div style={{ fontSize: '1.5rem', marginTop: 4 }}>{value}</div>
          </div>
        ))}
      </section>

      <h2>Recent policies</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem', fontSize: '0.9rem' }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
          <th style={{ padding: 6 }}>Policy</th><th>Provider</th><th>Tier</th><th>Coverage</th><th>Deadline</th><th>Status</th>
        </tr></thead>
        <tbody>
          {activity.policies.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 6, fontFamily: 'monospace' }}>{p.id.slice(0, 8)}</td>
              <td>{p.provider_id}</td>
              <td>{p.tier}</td>
              <td>${fmt(Number(p.coverage_usdt))}</td>
              <td>{new Date(p.deadline_at).toUTCString().slice(5, 22)}</td>
              <td>{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Recent claims</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
          <th style={{ padding: 6 }}>Claim</th><th>Trigger</th><th>Amount</th><th>Status</th><th>Tx</th>
        </tr></thead>
        <tbody>
          {activity.claims.map((c) => (
            <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 6, fontFamily: 'monospace' }}>{c.id.slice(0, 8)}</td>
              <td>{c.trigger}</td>
              <td>${fmt(Number(c.amount_usdt))}</td>
              <td>{c.status}</td>
              <td style={{ fontFamily: 'monospace' }}>{c.tx_hash ? c.tx_hash.slice(0, 14) + '…' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <footer style={{ marginTop: '3rem', color: '#888', fontSize: '0.85rem' }}>
        Solvency rules: coverage ≤ 50% of pool · ≤10% per provider · pays-once enforced in the database.
      </footer>
    </main>
  );
}
