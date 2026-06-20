/**
 * Rate limiting behind a small interface so the in-memory implementation used
 * in v1 can later be swapped for a distributed store (e.g. Upstash Redis)
 * without touching call sites.
 */

export interface RateLimitResult {
  /** Whether this request is permitted. */
  ok: boolean;
  /** Configured request ceiling for the window. */
  limit: number;
  /** Requests remaining in the current window (>= 0). */
  remaining: number;
  /** Unix epoch (ms) when the current window resets. */
  resetAt: number;
}

export interface RateLimiter {
  /**
   * Account for one request from `key` (typically a client IP) and report
   * whether it is within the limit.
   */
  check(key: string): RateLimitResult | Promise<RateLimitResult>;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Hard ceiling on the number of live buckets. Bounds worst-case memory under a
 * flood of unique keys (e.g. spoofed/varied client keys). When exceeded we
 * sweep expired buckets first; if still full, new keys are rejected (treated as
 * limited) until space frees, so the Map can never grow without bound.
 */
const MAX_BUCKETS = 50_000;

/**
 * Minimum wall-clock gap between full sweeps triggered from check(). Keeps the
 * per-request sweep O(1) amortized instead of O(n) on every call.
 */
const MIN_SWEEP_INTERVAL_MS = 1_000;

/**
 * Fixed-window, in-memory rate limiter. Process-local (fine for a single
 * instance / serverless warm path); swap for Upstash for multi-instance.
 *
 * Memory is bounded two ways: (1) every check() runs an interval-guarded sweep
 * that prunes expired buckets, and (2) a hard MAX_BUCKETS cap rejects brand-new
 * keys once the Map is full (after a forced sweep), so a flood of unique keys
 * cannot exhaust memory.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private lastSweepAt = 0;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    /** Injectable clock for deterministic tests. */
    private readonly now: () => number = Date.now,
  ) {}

  check(key: string): RateLimitResult {
    const now = this.now();

    // Interval-guarded sweep on EVERY check so expired buckets are reclaimed
    // even when traffic is all existing keys (no new/expired-bucket events).
    this.maybeSweep(now);

    let bucket = this.buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      // Creating (or replacing) a bucket. Enforce the hard cap for NEW keys.
      const isNewKey = !bucket;
      if (isNewKey && this.buckets.size >= MAX_BUCKETS) {
        // Try to make room by force-sweeping expired buckets — but only if we
        // haven't already swept at this exact clock value (avoids an O(n) scan
        // on every rejected request when the cap is hit and time isn't moving).
        if (this.lastSweepAt !== now) this.sweep(now);
        if (this.buckets.size >= MAX_BUCKETS) {
          // Still full: refuse to allocate a new bucket. Treat as limited so
          // the Map size stays bounded under unbounded unique-key pressure.
          return {
            ok: false,
            limit: this.limit,
            remaining: 0,
            resetAt: now + this.windowMs,
          };
        }
      }
      bucket = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(key, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, this.limit - bucket.count);
    return {
      ok: bucket.count <= this.limit,
      limit: this.limit,
      remaining,
      resetAt: bucket.resetAt,
    };
  }

  /** Current number of live buckets. Exposed for observability/tests. */
  get size(): number {
    return this.buckets.size;
  }

  /** Run a sweep at most once per MIN_SWEEP_INTERVAL_MS. */
  private maybeSweep(now: number): void {
    if (now - this.lastSweepAt < MIN_SWEEP_INTERVAL_MS) return;
    this.sweep(now);
  }

  /** Drop expired buckets to bound memory. */
  private sweep(now: number): void {
    this.lastSweepAt = now;
    for (const [k, b] of this.buckets) {
      if (now >= b.resetAt) this.buckets.delete(k);
    }
  }
}

/** Exposed for tests asserting the Map stays bounded. */
export const RATE_LIMIT_MAX_BUCKETS = MAX_BUCKETS;
