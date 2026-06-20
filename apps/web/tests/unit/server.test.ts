import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { clientKeyFromHeaders, readJsonBody } from '@/lib/server';
import { MAX_TOTAL_INPUT_BYTES } from '@/lib/config';

const ORIGINAL = { ...process.env };

beforeEach(() => {
  delete process.env.TRUSTED_PROXY;
  (process.env as Record<string, string>).NODE_ENV = 'test';
});
afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('clientKeyFromHeaders (XFF spoofing hardening)', () => {
  it('does NOT trust X-Forwarded-For when TRUSTED_PROXY is unset -> global key', () => {
    delete process.env.TRUSTED_PROXY;
    const a = clientKeyFromHeaders(new Headers({ 'x-forwarded-for': '1.1.1.1' }));
    const b = clientKeyFromHeaders(new Headers({ 'x-forwarded-for': '2.2.2.2' }));
    // Spoofing XFF must NOT yield a fresh bucket: both collapse to one key.
    expect(a).toBe('global');
    expect(b).toBe('global');
    expect(a).toBe(b);
  });

  it('ignores X-Real-IP too when TRUSTED_PROXY is unset', () => {
    delete process.env.TRUSTED_PROXY;
    expect(clientKeyFromHeaders(new Headers({ 'x-real-ip': '9.9.9.9' }))).toBe('global');
  });

  it('trusts the FIRST XFF token when TRUSTED_PROXY is truthy', () => {
    process.env.TRUSTED_PROXY = '1';
    const key = clientKeyFromHeaders(
      new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1, 10.0.0.2' }),
    );
    expect(key).toBe('203.0.113.7');
  });

  it('falsy TRUSTED_PROXY values are treated as untrusted', () => {
    for (const v of ['', '0', 'false', 'FALSE']) {
      process.env.TRUSTED_PROXY = v;
      expect(clientKeyFromHeaders(new Headers({ 'x-forwarded-for': '8.8.8.8' }))).toBe('global');
    }
  });

  it('trusted proxy but no forwarding header -> global (no unbounded per-request keys)', () => {
    process.env.TRUSTED_PROXY = '1';
    expect(clientKeyFromHeaders(new Headers())).toBe('global');
  });

  it('falls back to X-Real-IP when trusted and XFF absent', () => {
    process.env.TRUSTED_PROXY = 'yes';
    expect(clientKeyFromHeaders(new Headers({ 'x-real-ip': '198.51.100.4' }))).toBe('198.51.100.4');
  });
});

describe('readJsonBody', () => {
  it('returns too-large for an oversized declared content-length', async () => {
    const req = new Request('http://x', {
      method: 'POST',
      headers: { 'content-length': String(MAX_TOTAL_INPUT_BYTES * 2 + 1) },
      body: 'x',
    });
    const out = await readJsonBody(req);
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('unreachable');
    expect(out.reason).toBe('too-large');
  });

  it('returns too-large for an oversized decoded body', async () => {
    const big = 'a'.repeat(MAX_TOTAL_INPUT_BYTES * 2 + 10);
    const req = new Request('http://x', { method: 'POST', body: JSON.stringify(big) });
    const out = await readJsonBody(req);
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('unreachable');
    expect(out.reason).toBe('too-large');
  });

  it('returns bad-json for invalid JSON', async () => {
    const req = new Request('http://x', { method: 'POST', body: '{not json' });
    const out = await readJsonBody(req);
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('unreachable');
    expect(out.reason).toBe('bad-json');
  });

  it('parses valid JSON', async () => {
    const req = new Request('http://x', { method: 'POST', body: JSON.stringify({ email: 'a@b.co' }) });
    const out = await readJsonBody(req);
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('unreachable');
    expect(out.value).toEqual({ email: 'a@b.co' });
  });
});
