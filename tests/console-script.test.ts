import { describe, it, expect } from 'vitest';
import { UNDERWRITING_SCRIPT, stepEndTimes, totalRuntimeMs, type ConsoleStep } from '@/lib/console-script';

describe('console script', () => {
  it('script ids are unique and kinds are valid', () => {
    const ids = UNDERWRITING_SCRIPT.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of UNDERWRITING_SCRIPT) {
      expect(['cmd', 'out', 'event', 'seal', 'payout']).toContain(s.kind);
      expect(s.holdMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('tells the whole story: quote, bind, deadline, payout, pays-once', () => {
    const all = UNDERWRITING_SCRIPT.map((s) => s.text).join('\n');
    expect(all).toMatch(/get_quote/);
    expect(all).toMatch(/bind_policy/);
    expect(all).toMatch(/deadline/i);
    expect(all).toMatch(/0x[0-9a-f]{8}/i); // payout tx hash
    expect(all).toMatch(/once/i);
  });

  it('stepEndTimes is cumulative and monotonic', () => {
    const script: ConsoleStep[] = [
      { id: 'a', kind: 'cmd', text: '12345', holdMs: 100 }, // 5*20 + 100 = 200
      { id: 'b', kind: 'seal', text: 'stamp', holdMs: 300 }, // + 300 = 500
      { id: 'c', kind: 'out', text: '12', holdMs: 0 }, // + 40 = 540
    ];
    expect(stepEndTimes(script, 20)).toEqual([200, 500, 540]);
    expect(totalRuntimeMs(script, 20)).toBe(540);
  });

  it('full script runs under 25 seconds at 18ms/char', () => {
    expect(totalRuntimeMs(UNDERWRITING_SCRIPT, 18)).toBeLessThan(25_000);
  });
});
