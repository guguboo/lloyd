// The underwriting console's screenplay — one insured job, start to finish,
// as fixture data. Pure data + arithmetic so the player component stays dumb.

export type ConsoleStep = {
  id: string;
  kind: 'cmd' | 'out' | 'event' | 'seal' | 'payout';
  text: string;
  /** Pause after the step finishes rendering. */
  holdMs: number;
};

export const UNDERWRITING_SCRIPT: ConsoleStep[] = [
  { id: 'q-cmd', kind: 'cmd', text: 'lloyd.get_quote({ provider: "marlowe.agent", job_value: 18 })', holdMs: 350 },
  { id: 'q-out', kind: 'out', text: '→ premium $1.50 · coverage $14.40 · tier: Brigantine · expires 10m', holdMs: 900 },
  { id: 'b-cmd', kind: 'cmd', text: 'lloyd.bind_policy({ quote_id: "qt_7c21", job_ref: "okx:job:4189" })', holdMs: 350 },
  { id: 'b-seal', kind: 'seal', text: 'POLICY BOUND — plcy_09e4 · Lloyd is watching the chain', holdMs: 1200 },
  { id: 'w-1', kind: 'event', text: 'T-24h  deadline set · provider marlowe.agent notified', holdMs: 700 },
  { id: 'w-2', kind: 'event', text: 'T-0    deadline lapsed · no delivery attestation on X Layer', holdMs: 900 },
  { id: 'p-out', kind: 'payout', text: '✓ CLAIM PAID — $14.40 → buyer wallet · tx 0x9f3ab1c4…e7d2 (X Layer)', holdMs: 1000 },
  { id: 'p-once', kind: 'out', text: 'policy plcy_09e4 settled. Pays exactly once — enforced by the database.', holdMs: 0 },
];

const TYPED_KINDS: ReadonlySet<ConsoleStep['kind']> = new Set(['cmd', 'out']);

function stepDurationMs(step: ConsoleStep, msPerChar: number): number {
  const typing = TYPED_KINDS.has(step.kind) ? step.text.length * msPerChar : 0;
  return typing + step.holdMs;
}

/** Cumulative end time of each step — the player's timeline. */
export function stepEndTimes(script: ConsoleStep[], msPerChar: number): number[] {
  const out: number[] = [];
  let t = 0;
  for (const step of script) {
    t += stepDurationMs(step, msPerChar);
    out.push(t);
  }
  return out;
}

export function totalRuntimeMs(script: ConsoleStep[], msPerChar: number): number {
  const ends = stepEndTimes(script, msPerChar);
  return ends.length ? ends[ends.length - 1] : 0;
}
