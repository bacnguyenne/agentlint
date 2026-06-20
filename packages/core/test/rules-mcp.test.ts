import { describe, it, expect } from 'vitest';
import { lintOne, has } from './helpers.js';
import { applyFixes, parseJson } from '../src/index.js';

const P = '.mcp.json';

describe('mcp rules — triggering', () => {
  it('mcp/invalid-json on malformed JSON', () => {
    expect(has(lintOne(P, '{ bad'), 'mcp/invalid-json')).toBe(true);
  });

  it('mcp/missing-mcpservers when key absent', () => {
    expect(has(lintOne(P, '{"other":1}'), 'mcp/missing-mcpservers')).toBe(true);
  });

  it('mcp/mcpservers-is-array when it is an array', () => {
    expect(has(lintOne(P, '{"mcpServers":[]}'), 'mcp/mcpservers-is-array')).toBe(true);
  });

  it('mcp/server-missing-endpoint when no command or url', () => {
    const f = lintOne(P, '{"mcpServers":{"x":{"env":{}}}}');
    expect(has(f, 'mcp/server-missing-endpoint')).toBe(true);
  });

  it('mcp/invalid-transport for an unknown type', () => {
    const f = lintOne(P, '{"mcpServers":{"x":{"type":"ftp","url":"http://x"}}}');
    expect(has(f, 'mcp/invalid-transport')).toBe(true);
  });

  it('mcp/unknown-server-key for an unexpected key', () => {
    const f = lintOne(P, '{"mcpServers":{"x":{"command":"node","weird":1}}}');
    expect(has(f, 'mcp/unknown-server-key')).toBe(true);
  });
});

describe('mcp rules — clean', () => {
  const good =
    '{"mcpServers":{"fs":{"command":"npx","args":["-y","@scope/pkg@1.0.0"],"env":{"X":"1"}},"api":{"type":"http","url":"https://x","headers":{"Authorization":"${T}"}}}}';
  it('does not flag a valid mcp config', () => {
    const f = lintOne(P, good);
    expect(f.filter((x) => x.ruleId.startsWith('mcp/'))).toHaveLength(0);
  });

  it('accepts stdio servers with no type', () => {
    const f = lintOne(P, '{"mcpServers":{"x":{"command":"node","args":["s.js"]}}}');
    expect(has(f, 'mcp/invalid-transport')).toBe(false);
  });
});

describe('mcp autofix', () => {
  it('converts an mcpServers array into a name-keyed object', () => {
    const out = applyFixes({ path: P, content: '{"mcpServers":[{"name":"a","command":"node"}]}', kind: 'mcp' });
    const parsed = parseJson(out);
    const servers = (parsed.value as Record<string, unknown>)['mcpServers'] as Record<string, unknown>;
    expect(Array.isArray(servers)).toBe(false);
    expect(servers['a']).toEqual({ command: 'node' });
  });

  it('names anonymous array servers positionally', () => {
    const out = applyFixes({ path: P, content: '{"mcpServers":[{"command":"node"}]}', kind: 'mcp' });
    expect(out).toContain('server-1');
  });
});
