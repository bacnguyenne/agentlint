import { describe, it, expect } from 'vitest';
import { handleLint } from '@/lib/lint-handler';
import { InMemoryRateLimiter } from '@/lib/rate-limit';
import { RATE_LIMIT_WINDOW_MS, MAX_TOTAL_INPUT_BYTES } from '@/lib/config';

/** A fresh, generous limiter so rate limiting never interferes by accident. */
function freshLimiter(max = 1_000_000) {
  return new InMemoryRateLimiter(max, RATE_LIMIT_WINDOW_MS);
}

describe('handleLint', () => {
  it('happy path: returns findings for a bad subagent', async () => {
    const out = await handleLint({
      rawBody: {
        files: [
          {
            path: '.claude/agents/x.md',
            content: 'no frontmatter at all',
            kind: 'agent',
          },
        ],
      },
      clientKey: 'a',
      rateLimiter: freshLimiter(),
    });

    expect(out.status).toBe(200);
    if (out.status !== 200) throw new Error('unreachable');
    expect(out.body.result.summary.errors).toBeGreaterThan(0);
    const ids = out.body.result.findings.map((f) => f.ruleId);
    expect(ids).toContain('agent/missing-frontmatter');
    // Findings carry locations and the fixable flag.
    expect(out.body.result.findings[0]).toMatchObject({
      severity: 'error',
      fixable: expect.any(Boolean),
    });
  });

  it('clean config returns zero findings', async () => {
    const settings = JSON.stringify({
      permissions: { allow: ['Read', 'Edit'] },
      includeCoAuthoredBy: true,
    });
    const out = await handleLint({
      rawBody: { files: [{ path: '.claude/settings.json', content: settings }] },
      clientKey: 'clean',
      rateLimiter: freshLimiter(),
    });
    expect(out.status).toBe(200);
    if (out.status !== 200) throw new Error('unreachable');
    expect(out.body.result.findings).toHaveLength(0);
    expect(out.body.result.summary.errors).toBe(0);
  });

  it('oversized input returns 413', async () => {
    const huge = 'A'.repeat(MAX_TOTAL_INPUT_BYTES + 100);
    const out = await handleLint({
      rawBody: { files: [{ path: 'CLAUDE.md', content: huge }] },
      clientKey: 'big',
      rateLimiter: freshLimiter(),
    });
    expect(out.status).toBe(413);
  });

  it('malformed body (missing files) returns 400', async () => {
    const out = await handleLint({
      rawBody: { nope: true },
      clientKey: 'bad',
      rateLimiter: freshLimiter(),
    });
    expect(out.status).toBe(400);
  });

  it('malformed body (files not an array) returns 400', async () => {
    const out = await handleLint({
      rawBody: { files: 'oops' },
      clientKey: 'bad2',
      rateLimiter: freshLimiter(),
    });
    expect(out.status).toBe(400);
  });

  it('empty files array returns 400', async () => {
    const out = await handleLint({
      rawBody: { files: [] },
      clientKey: 'empty',
      rateLimiter: freshLimiter(),
    });
    expect(out.status).toBe(400);
  });

  it('security: a pasted secret is detected AND redacted in the response', async () => {
    const leaked = 'sk-ant-api03-SUPERSECRETVALUE1234567890abcdef';
    const mcp = JSON.stringify({
      mcpServers: {
        api: {
          type: 'http',
          url: 'https://example.com',
          headers: { Authorization: `Bearer ${leaked}` },
        },
      },
    });
    const out = await handleLint({
      rawBody: { files: [{ path: '.mcp.json', content: mcp }] },
      clientKey: 'sec',
      rateLimiter: freshLimiter(),
    });
    expect(out.status).toBe(200);
    if (out.status !== 200) throw new Error('unreachable');

    const ids = out.body.result.findings.map((f) => f.ruleId);
    expect(ids).toContain('security/hardcoded-secret');

    // The full secret must NEVER appear in any finding message (redaction).
    const allMessages = out.body.result.findings.map((f) => f.message).join('\n');
    expect(allMessages).not.toContain(leaked);
    expect(allMessages).not.toContain('SUPERSECRETVALUE');
  });

  it('rate limiting: returns 429 once the per-key limit is exceeded', async () => {
    const limiter = new InMemoryRateLimiter(2, RATE_LIMIT_WINDOW_MS);
    const body = {
      files: [{ path: 'CLAUDE.md', content: '# hi' }],
    };
    const first = await handleLint({ rawBody: body, clientKey: 'rl', rateLimiter: limiter });
    const second = await handleLint({ rawBody: body, clientKey: 'rl', rateLimiter: limiter });
    const third = await handleLint({ rawBody: body, clientKey: 'rl', rateLimiter: limiter });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    if (third.status !== 429) throw new Error('unreachable');
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('rate limit is per-key (independent IPs)', async () => {
    const limiter = new InMemoryRateLimiter(1, RATE_LIMIT_WINDOW_MS);
    const body = { files: [{ path: 'CLAUDE.md', content: '# hi' }] };
    const a = await handleLint({ rawBody: body, clientKey: 'ip-a', rateLimiter: limiter });
    const b = await handleLint({ rawBody: body, clientKey: 'ip-b', rateLimiter: limiter });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
  });

  it('too many files returns 400', async () => {
    const files = Array.from({ length: 50 }, (_, i) => ({
      path: `CLAUDE.md`,
      content: `# ${i}`,
    }));
    const out = await handleLint({
      rawBody: { files },
      clientKey: 'manyfiles',
      rateLimiter: freshLimiter(),
    });
    expect(out.status).toBe(400);
  });
});
