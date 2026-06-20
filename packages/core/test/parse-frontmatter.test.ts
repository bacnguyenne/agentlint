import { describe, it, expect } from 'vitest';
import { parseFrontmatter, normalizeText } from '../src/parse/frontmatter.js';

describe('normalizeText', () => {
  it('strips a leading BOM', () => {
    expect(normalizeText('﻿hello')).toBe('hello');
  });
  it('normalizes CRLF and lone CR to LF', () => {
    expect(normalizeText('a\r\nb\rc')).toBe('a\nb\nc');
  });
  it('leaves plain LF text unchanged', () => {
    expect(normalizeText('a\nb')).toBe('a\nb');
  });
});

describe('parseFrontmatter', () => {
  it('returns no frontmatter when the file does not start with ---', () => {
    const r = parseFrontmatter('# Heading\n\nbody');
    expect(r.hasFrontmatter).toBe(false);
    expect(r.data).toBeUndefined();
    expect(r.body).toBe('# Heading\n\nbody');
    expect(r.bodyStartLine).toBe(1);
  });

  it('parses a valid frontmatter block and body', () => {
    const r = parseFrontmatter('---\nname: foo\ndescription: bar\n---\n\nHello body');
    expect(r.hasFrontmatter).toBe(true);
    expect(r.data).toEqual({ name: 'foo', description: 'bar' });
    expect(r.body).toBe('Hello body');
    // opening fence line 1, name line 2, description line 3, closing line 4,
    // blank line 5 dropped, body begins line 6.
    expect(r.bodyStartLine).toBe(6);
    expect(r.frontmatterStartLine).toBe(2);
  });

  it('handles a closing fence of ...', () => {
    const r = parseFrontmatter('---\nname: x\n...\nbody');
    expect(r.hasFrontmatter).toBe(true);
    expect(r.data).toEqual({ name: 'x' });
    expect(r.body).toBe('body');
  });

  it('reports an error for an unterminated frontmatter block', () => {
    const r = parseFrontmatter('---\nname: x\nno closing fence');
    expect(r.hasFrontmatter).toBe(true);
    expect(r.error).toBeDefined();
    expect(r.body).toBe('');
  });

  it('reports an error for malformed YAML', () => {
    const r = parseFrontmatter('---\nname: : : :\n  - bad\n---\nbody');
    expect(r.error).toBeDefined();
    expect(r.error?.line).toBeGreaterThanOrEqual(2);
  });

  it('reports an error when frontmatter is a scalar, not a mapping', () => {
    const r = parseFrontmatter('---\njust a string\n---\nbody');
    expect(r.error).toBeDefined();
    expect(r.data).toBeUndefined();
  });

  it('treats an empty frontmatter block as data:undefined without error', () => {
    const r = parseFrontmatter('---\n---\nbody');
    expect(r.hasFrontmatter).toBe(true);
    expect(r.data).toBeUndefined();
    expect(r.error).toBeUndefined();
    expect(r.body).toBe('body');
  });

  it('handles CRLF frontmatter', () => {
    const r = parseFrontmatter('---\r\nname: y\r\n---\r\nbody');
    expect(r.data).toEqual({ name: 'y' });
    expect(r.body).toBe('body');
  });

  it('handles an empty file', () => {
    const r = parseFrontmatter('');
    expect(r.hasFrontmatter).toBe(false);
    expect(r.body).toBe('');
  });

  it('handles BOM before frontmatter fence', () => {
    const r = parseFrontmatter('﻿---\nname: z\n---\nbody');
    expect(r.hasFrontmatter).toBe(true);
    expect(r.data).toEqual({ name: 'z' });
  });
});
