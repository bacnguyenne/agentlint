/**
 * Framework-agnostic core of the POST /api/lint endpoint.
 *
 * Kept independent of Next's Request/Response so it can be unit-tested
 * directly (see lint-handler.test.ts). The thin route handler in
 * src/app/api/lint/route.ts adapts Next requests onto this.
 *
 * Security invariants enforced here:
 *  - Strict zod validation of the request body shape.
 *  - Hard total-input size cap (HTTP 413 over the limit).
 *  - Bounded file count and path length.
 *  - Rate limiting per client key (HTTP 429).
 *  - lintFiles is PURE: it never executes, imports, or fetches user content.
 */
import { lintFiles, type LintResult, type FileKind } from 'agentlint-core';
import { z } from 'zod';
import {
  MAX_FILES,
  MAX_PATH_LENGTH,
  MAX_TOTAL_INPUT_BYTES,
  byteLength,
} from './config';
import type { RateLimiter } from './rate-limit';

const FILE_KINDS = [
  'agent',
  'command',
  'skill',
  'settings',
  'mcp',
  'claudemd',
  'instructions',
  'unknown',
] as const satisfies readonly FileKind[];

/** Zod schema for a single file in the request. */
const fileSchema = z.object({
  path: z.string().min(1).max(MAX_PATH_LENGTH),
  content: z.string(),
  kind: z.enum(FILE_KINDS).optional(),
});

/** Zod schema for the full request body. */
export const lintRequestSchema = z.object({
  files: z.array(fileSchema).min(1).max(MAX_FILES),
});

export type LintRequest = z.infer<typeof lintRequestSchema>;

/** Discriminated result of running the handler. */
export type HandlerOutcome =
  | { status: 200; body: { result: LintResult } }
  | { status: 400; body: { error: string; details?: unknown } }
  | { status: 413; body: { error: string } }
  | { status: 429; body: { error: string }; retryAfterSeconds: number };

export interface HandlerDeps {
  /** Already-parsed JSON body (route handler does the JSON.parse + guards). */
  rawBody: unknown;
  /** Stable client identifier for rate limiting (usually an IP). */
  clientKey: string;
  rateLimiter: RateLimiter;
}

/**
 * Validate, rate-limit, and lint. Returns a structured outcome the route maps
 * onto an HTTP response. Never throws on user input.
 */
export async function handleLint(deps: HandlerDeps): Promise<HandlerOutcome> {
  const { rawBody, clientKey, rateLimiter } = deps;

  // 1) Rate limit before doing any work.
  const rl = await rateLimiter.check(clientKey);
  if (!rl.ok) {
    const retryAfterSeconds = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
    return {
      status: 429,
      body: { error: 'Too many requests. Please slow down.' },
      retryAfterSeconds,
    };
  }

  // 2) Validate shape.
  const parsed = lintRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return {
      status: 400,
      body: { error: 'Invalid request body.', details: parsed.error.flatten() },
    };
  }

  const { files } = parsed.data;

  // 3) Enforce total input size cap (sum of content + path bytes).
  let total = 0;
  for (const f of files) {
    total += byteLength(f.content) + byteLength(f.path);
    if (total > MAX_TOTAL_INPUT_BYTES) {
      return {
        status: 413,
        body: {
          error: `Input too large. Max ${Math.floor(
            MAX_TOTAL_INPUT_BYTES / 1024,
          )} KiB total.`,
        },
      };
    }
  }

  // 4) Lint. Pure, no I/O. Defensive try/catch so a bug can't 500 on input.
  try {
    const result = lintFiles(
      files.map((f) => ({
        path: f.path,
        content: f.content,
        ...(f.kind ? { kind: f.kind } : {}),
      })),
    );
    return { status: 200, body: { result } };
  } catch {
    return { status: 400, body: { error: 'Could not lint the provided input.' } };
  }
}
