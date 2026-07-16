import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeLimiter } from '@/lib/rate-limit';

describe('makeLimiter', () => {
  afterEach(() => vi.useRealTimers());

  it('allows up to maxReq hits in a window, rejects beyond', () => {
    const overLimit = makeLimiter(60_000, 3);
    expect(overLimit('a')).toBe(false);
    expect(overLimit('a')).toBe(false);
    expect(overLimit('a')).toBe(false);
    expect(overLimit('a')).toBe(true); // 4th in window
  });

  it('keys are independent', () => {
    const overLimit = makeLimiter(60_000, 1);
    expect(overLimit('a')).toBe(false);
    expect(overLimit('b')).toBe(false);
    expect(overLimit('a')).toBe(true);
  });

  it('window reset restores allowance', () => {
    vi.useFakeTimers();
    const overLimit = makeLimiter(60_000, 1);
    expect(overLimit('a')).toBe(false);
    expect(overLimit('a')).toBe(true);
    vi.advanceTimersByTime(60_001);
    expect(overLimit('a')).toBe(false);
  });
});
