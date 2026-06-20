/**
 * POST /api/lint — validate pasted agent-config files.
 *
 * Stateless, no persistence, no cookies (CSRF-safe by construction). Delegates
 * all logic to the framework-agnostic handler so it can be unit-tested.
 */
import { NextResponse } from 'next/server';
import { handleLint } from '@/lib/lint-handler';
import { clientKeyFromHeaders, lintRateLimiter, readJsonBody } from '@/lib/server';

// Node runtime: agentlint-core uses the `yaml` package; keep off the edge.
export const runtime = 'nodejs';
// Never cache or pre-render: this is a pure POST API.
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  const body = await readJsonBody(request);
  if (!body.ok) {
    if (body.reason === 'too-large') {
      return NextResponse.json(
        { error: 'Input too large.' },
        { status: 413, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return NextResponse.json(
      { error: 'Request body must be valid JSON.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const outcome = await handleLint({
    rawBody: body.value,
    clientKey: clientKeyFromHeaders(request.headers),
    rateLimiter: lintRateLimiter,
  });

  const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
  if (outcome.status === 429) {
    headers['Retry-After'] = String(outcome.retryAfterSeconds);
  }

  return NextResponse.json(outcome.body, { status: outcome.status, headers });
}

/** Reject non-POST methods explicitly. */
export function GET(): NextResponse {
  return NextResponse.json({ error: 'Method not allowed.' }, { status: 405 });
}
