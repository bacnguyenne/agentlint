import { describe, it, expect } from 'vitest';
import { lintFiles, lintFilesWithFixes, rules, parseJson } from '../src/index.js';
import { MAX_CONTENT_BYTES } from '../src/engine.js';

describe('engine', () => {
  it('classifies by path when kind is omitted', () => {
    const r = lintFiles([{ path: '.mcp.json', content: '{"other":1}' }]);
    expect(r.findings.some((f) => f.ruleId === 'mcp/missing-mcpservers')).toBe(true);
  });

  it('computes a summary with counts and filesChecked', () => {
    const r = lintFiles([
      { path: '.claude/settings.json', content: '{"permissions":{"allow":["*"]},"totallyUnknownKey":1}' },
    ]);
    expect(r.summary.filesChecked).toBe(1);
    expect(r.summary.warnings).toBeGreaterThanOrEqual(1);
    expect(r.summary.infos).toBeGreaterThanOrEqual(1);
  });

  it('applies a severity override', () => {
    const content = '{"totallyUnknownKey":1}';
    const base = lintFiles([{ path: '.claude/settings.json', content }]);
    expect(base.findings.find((f) => f.ruleId === 'settings/unknown-key')?.severity).toBe('info');
    const bumped = lintFiles([{ path: '.claude/settings.json', content }], {
      rules: { 'settings/unknown-key': 'error' },
    });
    expect(bumped.findings.find((f) => f.ruleId === 'settings/unknown-key')?.severity).toBe('error');
    expect(bumped.summary.errors).toBeGreaterThanOrEqual(1);
  });

  it('disables a rule when set to off', () => {
    const r = lintFiles([{ path: '.claude/settings.json', content: '{"totallyUnknownKey":1}' }], {
      rules: { 'settings/unknown-key': 'off' },
    });
    expect(r.findings.some((f) => f.ruleId === 'settings/unknown-key')).toBe(false);
  });

  it('flags and skips an oversized file', () => {
    const big = 'a'.repeat(MAX_CONTENT_BYTES + 1);
    const r = lintFiles([{ path: 'CLAUDE.md', content: big }]);
    expect(r.findings.some((f) => f.ruleId === 'core/file-too-large')).toBe(true);
  });

  it('sorts findings deterministically by file/line/column/id', () => {
    const r = lintFiles([
      { path: 'b/CLAUDE.md', content: '' },
      { path: 'a/CLAUDE.md', content: '' },
    ]);
    const files = r.findings.map((f) => f.file);
    const sorted = [...files].sort();
    expect(files).toEqual(sorted);
  });

  it('lintFilesWithFixes returns patched contents', () => {
    const { result, fixedFiles } = lintFilesWithFixes(
      [{ path: '.claude/agents/reviewer.md', content: '---\nname: Bad_Name\ndescription: d\n---\nbody' }],
      { fix: true },
    );
    // invalid-name slugifies, then name-filename-mismatch aligns to the basename.
    expect(fixedFiles.get('.claude/agents/reviewer.md')).toContain('name: reviewer');
    // After fixing, both name findings should be gone.
    expect(result.findings.some((f) => f.ruleId === 'agent/invalid-name')).toBe(false);
    expect(result.findings.some((f) => f.ruleId === 'agent/name-filename-mismatch')).toBe(false);
  });

  it('does not produce findings for unknown file kinds', () => {
    const r = lintFiles([{ path: 'random.txt', content: 'sk-ABCDEF1234567890ABCDEF1234567890XYZ' }]);
    expect(r.findings).toHaveLength(0);
  });

  // Regression (fix 1): a settings.json with reserved keys must parse them as
  // own keys (no prototype pollution, no silent content loss). The
  // settings/unknown-key info rule should fire for each.
  it('handles a settings.json with __proto__/constructor/prototype keys safely', () => {
    const content = '{"__proto__": 1, "constructor": 2, "prototype": 3}';
    const r = lintFiles([{ path: '.claude/settings.json', content }]);
    const unknown = r.findings.filter((f) => f.ruleId === 'settings/unknown-key');
    // No content silently lost: each reserved key surfaces as an unknown key.
    const reported = unknown.map((f) => f.message);
    for (const k of ['__proto__', 'constructor', 'prototype']) {
      expect(reported.some((m) => m.includes(`"${k}"`))).toBe(true);
    }
    // And the parser itself yields a null-prototype object with own keys.
    const parsed = parseJson(content).value as Record<string, unknown>;
    expect(Object.getPrototypeOf(parsed)).toBeNull();
    expect(Object.prototype.hasOwnProperty.call(parsed, '__proto__')).toBe(true);
  });
});

describe('rule catalog', () => {
  it('exposes a non-empty catalog with stable shape', () => {
    expect(rules.length).toBeGreaterThan(20);
    for (const r of rules) {
      expect(typeof r.id).toBe('string');
      expect(['error', 'warning', 'info']).toContain(r.severity);
      expect(typeof r.fixable).toBe('boolean');
      expect(typeof r.docsSlug).toBe('string');
      expect(r.meta.title.length).toBeGreaterThan(0);
      expect(r.meta.description.length).toBeGreaterThan(0);
      expect(r.appliesTo.length).toBeGreaterThan(0);
      expect(typeof r.check).toBe('function');
      if (r.fixable) expect(typeof r.fix).toBe('function');
    }
  });

  it('has unique rule ids', () => {
    const ids = rules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers every rule group from the spec', () => {
    const prefixes = new Set(rules.map((r) => r.id.split('/')[0]));
    for (const p of ['agent', 'command', 'settings', 'mcp', 'security', 'claudemd']) {
      expect(prefixes.has(p)).toBe(true);
    }
  });

  // Regression (fix 8): the engine emits `core/file-too-large`, so it must also
  // appear in the exported catalog (web /rules + docs).
  it('includes core/file-too-large in the catalog', () => {
    const rule = rules.find((r) => r.id === 'core/file-too-large');
    expect(rules.some((r) => r.id === 'core/file-too-large')).toBe(true);
    expect(rule?.severity).toBe('warning');
    expect(rule?.fixable).toBe(false);
    expect(rule?.appliesTo.length).toBeGreaterThan(0);
  });
});
