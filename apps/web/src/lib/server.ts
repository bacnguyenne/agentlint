/**
 * Server-only helpers shared by the API route handlers: singleton rate
 * limiters, client-key extraction, and safe JSON body reading.
 */
import 'server-only';
import { InMemoryRateLimiter } from './rate-limit';
import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS, MAX_TOTAL_INPUT_BYTES } from './config';

/**
 * Process-wide limiters. Module singletons survive across requests on a warm
 * server/lambda. For multi-instance deployments swap InMemoryRateLimiter for an
 * Upstash-backed implementation of the same RateLimiter interface.
 */
/**
 * Production default is the strict `RATE_LIMIT_MAX` (30 req / 60s). An optional
 * `AGENTLINT_RATE_LIMIT_MAX` env override lets a test environment relax the limit
 * WITHOUT weakening production — the parallel Playwright e2e suite otherwise
 * trips the limit from a single client IP and flakes. Read here (a `server-only`
 * module) so it is a runtime value, never inlined into the client bundle.
 */
const rateLimitMax = Number(process.env.AGENTLINT_RATE_LIMIT_MAX) || RATE_LIMIT_MAX;
export const lintRateLimiter = new InMemoryRateLimiter(rateLimitMax, RATE_LIMIT_WINDOW_MS);

/** Fixed key used when no trusted proxy is configured: the limit is global. */
const GLOBAL_KEY = 'global';

/** Whether the operator asserts a trusted upstream proxy sets X-Forwarded-For. */
function trustProxy(): boolean {
  const v = process.env.TRUSTED_PROXY;
  return v != null && v !== '' && v !== '0' && v.toLowerCase() !== 'false';
}

let warnedUntrustedProxy = false;

/**
 * Derive a client key from request headers for rate limiting.
 *
 * SECURITY: X-Forwarded-For is attacker-controlled unless a trusted upstream
 * proxy strips/sets it. This app is self-hosted with NO guaranteed proxy, so
 * trusting XFF would let an attacker rotate the header to get a fresh limiter
 * bucket on every request (limiter bypass). We therefore only trust XFF when
 * the operator opts in via the `TRUSTED_PROXY` env var (asserting a proxy
 * controls the header); we then use the FIRST (client-most) XFF token.
 *
 * When TRUSTED_PROXY is unset we do NOT trust XFF (or X-Real-IP) at all and
 * fall back to a single fixed key, so the limit applies GLOBALLY and cannot be
 * bypassed by header spoofing. A one-time warning is emitted in production to
 * make the degraded (global) posture visible to operators.
 */
export function clientKeyFromHeaders(headers: Headers): string {
  if (!trustProxy()) {
    if (
      !warnedUntrustedProxy &&
      process.env.NODE_ENV === 'production'
    ) {
      warnedUntrustedProxy = true;
      console.warn(
        '[agentlint] TRUSTED_PROXY is not set: X-Forwarded-For is NOT trusted ' +
          '(it is attacker-spoofable without an upstream proxy). The rate limiter ' +
          'is applying a single GLOBAL limit to all clients until you place this ' +
          'app behind a proxy that sets X-Forwarded-For and set TRUSTED_PROXY=1.',
      );
    }
    return GLOBAL_KEY;
  }

  // A trusted proxy is asserted: the FIRST XFF token is the real client IP.
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = headers.get('x-real-ip');
  if (real) {
    const trimmed = real.trim();
    if (trimmed) return trimmed;
  }
  // Trusted proxy asserted but no forwarding header present: stay global rather
  // than per-request, so we never accidentally create unbounded buckets.
  return GLOBAL_KEY;
}

/**
 * Read and JSON-parse a request body with a guard against oversized payloads
 * BEFORE buffering the whole thing where possible (Content-Length check), and a
 * hard cap on the decoded text. Returns `{ ok:false }` instead of throwing.
 */
export async function readJsonBody(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false; reason: 'too-large' | 'bad-json' }> {
  // Fast reject by declared length when present.
  const lenHeader = request.headers.get('content-length');
  if (lenHeader) {
    const declared = Number(lenHeader);
    if (Number.isFinite(declared) && declared > MAX_TOTAL_INPUT_BYTES * 2) {
      return { ok: false, reason: 'too-large' };
    }
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, reason: 'bad-json' };
  }

  // Hard cap on the raw text (the handler also enforces a per-content cap).
  if (new TextEncoder().encode(text).length > MAX_TOTAL_INPUT_BYTES * 2) {
    return { ok: false, reason: 'too-large' };
  }

  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, reason: 'bad-json' };
  }
}
