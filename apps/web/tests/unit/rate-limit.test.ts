import { describe, it, expect } from 'vitest';
import { InMemoryRateLimiter, RATE_LIMIT_MAX_BUCKETS } from '@/lib/rate-limit';

const WINDOW = 60_000;

describe('InMemoryRateLimiter', () => {
  it('fixed window: blocks once the per-key limit is exceeded', () => {
    let now = 0;
    const rl = new InMemoryRateLimiter(2, WINDOW, () => now);
    expect(rl.check('k').ok).toBe(true);
    expect(rl.check('k').ok).toBe(true);
    expect(rl.check('k').ok).toBe(false);
    // Roll the window forward; the key resets.
    now += WINDOW;
    expect(rl.check('k').ok).toBe(true);
  });

  it('is per-key independent', () => {
    let now = 0;
    const rl = new InMemoryRateLimiter(1, WINDOW, () => now);
    expect(rl.check('a').ok).toBe(true);
    expect(rl.check('b').ok).toBe(true);
    expect(rl.check('a').ok).toBe(false);
  });

  it('prunes expired buckets via the interval-guarded sweep on check()', () => {
    let now = 0;
    const rl = new InMemoryRateLimiter(5, WINDOW, () => now);
    // Create 100 short-lived keys.
    for (let i = 0; i < 100; i++) rl.check(`old-${i}`);
    expect(rl.size).toBe(100);

    // Advance past the window AND past the sweep interval, then touch one key.
    now += WINDOW + 5_000;
    rl.check('trigger');

    // The 100 expired buckets are gone; only the live 'trigger' remains.
    expect(rl.size).toBe(1);
  });

  it('stays bounded by MAX_BUCKETS under many unique, non-expiring keys', () => {
    // Frozen clock => no bucket ever expires => pure pressure on the hard cap.
    const rl = new InMemoryRateLimiter(1, WINDOW, () => 0);
    const overflow = RATE_LIMIT_MAX_BUCKETS + 25_000;

    let rejectedNewKey = false;
    for (let i = 0; i < overflow; i++) {
      const res = rl.check(`uniq-${i}`);
      // First request of a fresh key is allowed (count 1 <= limit 1) UNLESS the
      // cap is hit, in which case a new key is refused (ok:false).
      if (!res.ok) rejectedNewKey = true;
      // INVARIANT: the Map never grows past the hard cap.
      expect(rl.size).toBeLessThanOrEqual(RATE_LIMIT_MAX_BUCKETS);
    }

    expect(rl.size).toBe(RATE_LIMIT_MAX_BUCKETS);
    // Once full, brand-new keys are rejected rather than allocated.
    expect(rejectedNewKey).toBe(true);
    const after = rl.check('one-more-brand-new-key');
    expect(after.ok).toBe(false);
    expect(rl.size).toBe(RATE_LIMIT_MAX_BUCKETS);
  });

  it('existing keys still work when the cap is reached (no allocation needed)', () => {
    const rl = new InMemoryRateLimiter(3, WINDOW, () => 0);
    for (let i = 0; i < RATE_LIMIT_MAX_BUCKETS; i++) rl.check(`k-${i}`);
    expect(rl.size).toBe(RATE_LIMIT_MAX_BUCKETS);
    // An EXISTING key keeps counting against its bucket even though we're full.
    const r1 = rl.check('k-0');
    expect(r1.ok).toBe(true);
    const r2 = rl.check('k-0');
    expect(r2.ok).toBe(true);
    const r3 = rl.check('k-0');
    expect(r3.ok).toBe(false); // 4th hit on a limit-3 bucket
    expect(rl.size).toBe(RATE_LIMIT_MAX_BUCKETS);
  });
});
