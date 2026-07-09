import { describe, it, expect, beforeEach, vi } from 'vitest';

// D5/D5.1/D7: lib/store.ts's DB-interaction logic (the money-safety code) had ZERO
// direct coverage — the settlement tests mock the store away. Here we go one layer
// deeper and mock `@/lib/db` so the REAL bindQuote / markClaimPaid run against a fake
// supabase-js client. No live DB, no network.
//
// The fake mirrors ONLY the query-builder chains these two functions use. Each result is
// keyed by `${table}.${verb}` where verb is the FIRST operation after `.from(table)`
// (insert/select/update/delete). A trailing `.select('*')` on an insert/update is a
// PostgREST "returning" clause, not a new verb, so it's recorded as a filter, keeping the
// key unambiguous. Terminal `.single()/.maybeSingle()` and a bare `await` on the builder
// all resolve to the configured `{ data, error }`. `state.calls` records every operation
// (table, verb, payload, filters) so tests can assert what was written.
const h = vi.hoisted(() => ({
  state: {
    results: {} as Record<string, { data?: unknown; error?: unknown }>,
    calls: [] as Array<{ table: string; verb: string; payload: unknown; filters: Array<{ m: string; args: unknown[] }> }>,
  },
}));

vi.mock('@/lib/db', () => {
  const { state } = h;
  const from = (table: string) => {
    const op = { table, verb: '', payload: undefined as unknown, filters: [] as Array<{ m: string; args: unknown[] }> };
    const finish = () => {
      const r = state.results[`${table}.${op.verb}`] ?? { data: null, error: null };
      return Promise.resolve({ data: r.data ?? null, error: r.error ?? null });
    };
    const builder: Record<string, unknown> = {};
    const operation = (verb: string) => (payload?: unknown) => {
      if (!op.verb) { op.verb = verb; op.payload = payload; state.calls.push(op); }
      else op.filters.push({ m: verb, args: payload === undefined ? [] : [payload] }); // e.g. insert(...).select('*')
      return builder;
    };
    builder.select = operation('select');
    builder.insert = operation('insert');
    builder.update = operation('update');
    builder.delete = operation('delete');
    for (const m of ['eq', 'in', 'gt', 'order', 'limit']) {
      builder[m] = (...args: unknown[]) => { op.filters.push({ m, args }); return builder; };
    }
    builder.single = finish;
    builder.maybeSingle = finish;
    // thenable: chains that don't end in single/maybeSingle are `await`ed directly
    builder.then = (onF: (v: unknown) => unknown, onR: (e: unknown) => unknown) => finish().then(onF, onR);
    return builder;
  };
  return { supabaseAdmin: { from } };
});

import { bindQuote, markClaimPaid } from '@/lib/store';
import type { PolicyRow, QuoteRow } from '@/lib/store';
import { TIERS } from '@/lib/underwrite/engine';

// Configure what each `${table}.${verb}` resolves to for the current test.
function configure(results: Record<string, { data?: unknown; error?: unknown }>) {
  h.state.results = results;
}
const findOp = (table: string, verb: string) => h.state.calls.find(c => c.table === table && c.verb === verb);
const allOps = (table: string, verb: string) => h.state.calls.filter(c => c.table === table && c.verb === verb);

const openQuote: QuoteRow = {
  id: 'q-1', provider_id: 'prov-1', buyer_wallet: '0xBUYER', job_value_usdt: 20,
  job_type: 'design', risk_class: 'B', recommended_tier: 'frigate', newcomer: false,
  status: 'open', expires_at: '2999-01-01T00:00:00Z',
};
const insertedPolicy: PolicyRow = {
  id: 'pol-1', quote_id: 'q-1', provider_id: 'prov-1', buyer_wallet: '0xBUYER',
  job_ref: 'job-1', job_value_usdt: 20, tier: 'frigate', coverage_usdt: 16,
  premium_usdt: TIERS.frigate, deadline_at: '2026-07-14T12:00:00Z', status: 'active',
  created_at: '2026-07-01T00:00:00Z',
};

beforeEach(() => {
  h.state.calls = [];
  h.state.results = {};
});

describe('bindQuote — post-insert solvency recheck + compensating unwind (D5 / D5.1)', () => {
  it('1. happy path: recheck passes → quote bound, premium ledger written, no delete, returns policy', async () => {
    configure({
      'quotes.select': { data: openQuote },
      'policies.insert': { data: insertedPolicy },
      'policies.select': { data: [{ coverage_usdt: 16 }] }, // outstanding = 16
      'ledger_events.select': { data: [{ amount_usdt: 100 }] }, // pool = 100 → cap = 50; 16 <= 50 ok
    });

    const result = await bindQuote('q-1', 'frigate', 'job-1', '2026-07-14T12:00:00Z');

    expect(result).toEqual(insertedPolicy);
    // premium ledger event written with the tier price
    const ledger = findOp('ledger_events', 'insert');
    expect(ledger?.payload).toMatchObject({ kind: 'premium', amount_usdt: TIERS.frigate, policy_id: 'pol-1' });
    // quote flipped to bound
    expect(findOp('quotes', 'update')?.payload).toEqual({ status: 'bound' });
    // no compensating delete on the happy path
    expect(findOp('policies', 'delete')).toBeUndefined();
  });

  it('2. over-commit: recheck breaches cap → compensating delete fires, throws solvency_recheck_failed, no premium written', async () => {
    configure({
      'quotes.select': { data: openQuote },
      'policies.insert': { data: insertedPolicy },
      'policies.select': { data: [{ coverage_usdt: 60 }] }, // outstanding = 60
      'ledger_events.select': { data: [{ amount_usdt: 100 }] }, // pool = 100 → cap = 50; 60 > 50 breach
      'policies.delete': { error: null }, // unwind succeeds
    });

    await expect(bindQuote('q-1', 'frigate', 'job-1', '2026-07-14T12:00:00Z'))
      .rejects.toThrow(/^solvency_recheck_failed$/);

    // compensating delete targeted the just-inserted policy
    const del = findOp('policies', 'delete');
    expect(del).toBeDefined();
    expect(del?.filters).toContainEqual({ m: 'eq', args: ['id', 'pol-1'] });
    // NO money event written, and the quote was never bound
    expect(findOp('ledger_events', 'insert')).toBeUndefined();
    expect(findOp('quotes', 'update')).toBeUndefined();
  });

  it('3. unwind failure: the compensating delete itself errors → throws the combined message', async () => {
    configure({
      'quotes.select': { data: openQuote },
      'policies.insert': { data: insertedPolicy },
      'policies.select': { data: [{ coverage_usdt: 60 }] },
      'ledger_events.select': { data: [{ amount_usdt: 100 }] },
      'policies.delete': { error: { message: 'delete boom' } }, // unwind fails loudly
    });

    await expect(bindQuote('q-1', 'frigate', 'job-1', '2026-07-14T12:00:00Z'))
      .rejects.toThrow('solvency_recheck_failed_and_unwind_failed: delete boom');

    expect(findOp('ledger_events', 'insert')).toBeUndefined();
  });

  it('4. quote not open (expired/already bound) → throws quote_not_open, nothing inserted', async () => {
    configure({ 'quotes.select': { data: null } });

    await expect(bindQuote('q-1', 'frigate', 'job-1', '2026-07-14T12:00:00Z'))
      .rejects.toThrow('quote_not_open');

    expect(findOp('policies', 'insert')).toBeUndefined();
  });
});

describe('markClaimPaid — idempotency + D5.1 self-heal', () => {
  it('5. normal: guarded UPDATE matches → writes a NEGATIVE payout ledger event with the tx hash', async () => {
    configure({
      'claims.update': { data: { policy_id: 'pol-1', amount_usdt: 16 } },
      'ledger_events.insert': { error: null },
    });

    await expect(markClaimPaid('clm-1', '0xTX')).resolves.toBeUndefined();

    const ledger = findOp('ledger_events', 'insert');
    expect(ledger?.payload).toEqual({ kind: 'payout', amount_usdt: -16, policy_id: 'pol-1', tx_hash: '0xTX' });
  });

  it('6. already-paid heal: zero-row UPDATE + lookup shows status paid → re-inserts payout; 23505 is success (no throw, not double-counted)', async () => {
    configure({
      'claims.update': { data: null }, // guarded UPDATE matched zero rows
      'claims.select': { data: { policy_id: 'pol-1', amount_usdt: 16, status: 'paid' } },
      'ledger_events.insert': { error: { code: '23505' } }, // one_payout_per_policy → already debited
    });

    await expect(markClaimPaid('clm-1', '0xTX')).resolves.toBeUndefined();

    // heal attempted exactly one payout insert, with the correct negative amount
    const inserts = allOps('ledger_events', 'insert');
    expect(inserts).toHaveLength(1);
    expect(inserts[0].payload).toEqual({ kind: 'payout', amount_usdt: -16, policy_id: 'pol-1', tx_hash: '0xTX' });
  });

  it('7. normal-path 23505: the payout ledger insert returns a duplicate → returns cleanly (no throw)', async () => {
    configure({
      'claims.update': { data: { policy_id: 'pol-1', amount_usdt: 16 } },
      'ledger_events.insert': { error: { code: '23505' } },
    });

    await expect(markClaimPaid('clm-1', '0xTX')).resolves.toBeUndefined();
  });

  it('8. claim_not_found: zero-row UPDATE + lookup returns null → throws claim_not_found, no ledger write', async () => {
    configure({
      'claims.update': { data: null },
      'claims.select': { data: null },
    });

    await expect(markClaimPaid('clm-1', '0xTX')).rejects.toThrow('claim_not_found');
    expect(findOp('ledger_events', 'insert')).toBeUndefined();
  });
});
