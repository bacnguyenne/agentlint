import { describe, it, expect } from 'vitest';
import { lintOne, has } from './helpers.js';
import { applyFixes } from '../src/index.js';

const SET = '.claude/settings.json';
const MCP = '.mcp.json';
const CMD = '.claude/commands/x.md';

describe('settings edge cases', () => {
  it('flags a non-object hook handler', () => {
    const f = lintOne(SET, '{"hooks":{"Stop":[{"hooks":["not-an-object"]}]}}');
    expect(has(f, 'settings/hook-missing-command')).toBe(true);
  });

  it('flags a non-string model value', () => {
    const f = lintOne(SET, '{"model":123}');
    expect(has(f, 'settings/invalid-model')).toBe(true);
  });

  it('does not crash on hooks being null', () => {
    const f = lintOne(SET, '{"hooks":null}');
    expect(Array.isArray(f)).toBe(true);
  });

  it('does not crash on permissions.allow with non-string entries', () => {
    const f = lintOne(SET, '{"permissions":{"allow":[123,null,"*"]}}');
    expect(has(f, 'security/broad-permissions')).toBe(true);
  });
});

describe('mcp edge cases', () => {
  it('flags a non-object server entry as missing endpoint', () => {
    const f = lintOne(MCP, '{"mcpServers":{"x":"not-an-object"}}');
    expect(has(f, 'mcp/server-missing-endpoint')).toBe(true);
  });

  it('skips a non-object server for transport/unknown-key/auth checks', () => {
    const f = lintOne(MCP, '{"mcpServers":{"x":42}}');
    expect(has(f, 'mcp/invalid-transport')).toBe(false);
    expect(has(f, 'mcp/unknown-server-key')).toBe(false);
  });

  it('does not flag unpinned when runner has only flags', () => {
    const f = lintOne(MCP, '{"mcpServers":{"x":{"command":"npx","args":["-y"]}}}');
    expect(has(f, 'security/unpinned-mcp-package')).toBe(false);
  });

  it('autofix on array with a non-object entry names it positionally', () => {
    const out = applyFixes({ path: MCP, content: '{"mcpServers":["bad"]}', kind: 'mcp' });
    expect(out).toContain('server-1');
  });
});

describe('command edge cases', () => {
  it('handles flow-style frontmatter keys without crashing', () => {
    const f = lintOne(CMD, '---\n{description: d, bogus: 1}\n---\nbody');
    // bogus is unknown; the rule still reports it (location may be absent).
    expect(has(f, 'command/unknown-key')).toBe(true);
  });

  it('handles an agent frontmatter where tools is a non-string/non-array', () => {
    const f = lintOne('.claude/agents/a.md', '---\nname: a\ndescription: d\ntools: 123\n---\nbody');
    // numeric tools yields an empty extracted list -> no unknown-tool finding.
    expect(has(f, 'agent/unknown-tool')).toBe(false);
  });
});
