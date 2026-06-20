import { describe, it, expect } from 'vitest';
import { applyFixes } from '../src/index.js';
import type { FileKind } from '../src/types.js';

const cases: Array<{ name: string; path: string; kind: FileKind; content: string }> = [
  {
    name: 'agent invalid name + mismatch + bad model',
    path: '.claude/agents/reviewer.md',
    kind: 'agent',
    content: '---\nname: Bad_Name\ndescription: d\nmodel: gpt-4o\n---\nbody',
  },
  {
    name: 'command bad model',
    path: '.claude/commands/x.md',
    kind: 'command',
    content: '---\ndescription: d\nmodel: gpt-4o\n---\nbody',
  },
  {
    name: 'settings array hooks + object matcher + bad model',
    path: '.claude/settings.json',
    kind: 'settings',
    content: '{"model":"claude-x-latest","hooks":[{"event":"PreToolUse","matcher":{"toolName":"Bash"},"hooks":[{"type":"command","command":"echo x"}]}]}',
  },
  {
    name: 'mcp array servers',
    path: '.mcp.json',
    kind: 'mcp',
    content: '{"mcpServers":[{"name":"a","command":"node"},{"command":"node"}]}',
  },
];

describe('autofix idempotency', () => {
  for (const c of cases) {
    it(`${c.name}: fixing twice equals fixing once`, () => {
      const once = applyFixes({ path: c.path, content: c.content, kind: c.kind });
      const twice = applyFixes({ path: c.path, content: once, kind: c.kind });
      expect(twice).toBe(once);
    });
  }

  it('fixing already-clean content is a no-op (modulo normalization)', () => {
    const clean = '---\nname: reviewer\ndescription: d\nmodel: sonnet\n---\nbody\n';
    const out = applyFixes({ path: '.claude/agents/reviewer.md', content: clean, kind: 'agent' });
    expect(out).toBe(clean);
  });

  it('normalizes CRLF without otherwise changing clean content', () => {
    const crlf = '---\r\nname: reviewer\r\ndescription: d\r\n---\r\nbody\r\n';
    const out = applyFixes({ path: '.claude/agents/reviewer.md', content: crlf, kind: 'agent' });
    expect(out).toBe('---\nname: reviewer\ndescription: d\n---\nbody\n');
    // And idempotent on the normalized output.
    expect(applyFixes({ path: '.claude/agents/reviewer.md', content: out, kind: 'agent' })).toBe(out);
  });
});
