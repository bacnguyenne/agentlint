import { describe, it, expect } from 'vitest';
import { lintOne, has } from './helpers.js';
import { applyFixes, parseJson } from '../src/index.js';

const P = '.claude/settings.json';

describe('settings rules — triggering', () => {
  it('settings/invalid-json on malformed JSON', () => {
    expect(has(lintOne(P, '{ bad'), 'settings/invalid-json')).toBe(true);
  });

  it('settings/invalid-json when top-level is not an object', () => {
    expect(has(lintOne(P, '[1,2,3]'), 'settings/invalid-json')).toBe(true);
  });

  it('settings/hooks-not-object when hooks is an array', () => {
    const f = lintOne(P, '{"hooks":[{"event":"PreToolUse","hooks":[{"type":"command","command":"x"}]}]}');
    expect(has(f, 'settings/hooks-not-object')).toBe(true);
  });

  it('settings/hook-matcher-not-string when matcher is an object', () => {
    const f = lintOne(P, '{"hooks":{"PreToolUse":[{"matcher":{"toolName":"Bash"},"hooks":[{"type":"command","command":"x"}]}]}}');
    expect(has(f, 'settings/hook-matcher-not-string')).toBe(true);
  });

  it('settings/hooks-unknown-event for a bogus event', () => {
    const f = lintOne(P, '{"hooks":{"Bogus":[{"hooks":[{"type":"command","command":"x"}]}]}}');
    expect(has(f, 'settings/hooks-unknown-event')).toBe(true);
  });

  it('settings/hook-missing-command when handler lacks command', () => {
    const f = lintOne(P, '{"hooks":{"Stop":[{"hooks":[{"type":"command"}]}]}}');
    expect(has(f, 'settings/hook-missing-command')).toBe(true);
  });

  it('settings/hook-missing-command when group has no hooks array', () => {
    const f = lintOne(P, '{"hooks":{"Stop":[{"matcher":""}]}}');
    expect(has(f, 'settings/hook-missing-command')).toBe(true);
  });

  it('settings/invalid-model for a -latest id', () => {
    const f = lintOne(P, '{"model":"claude-3-5-sonnet-latest"}');
    expect(has(f, 'settings/invalid-model')).toBe(true);
  });

  it('settings/unknown-key for an unrecognized top key', () => {
    const f = lintOne(P, '{"totallyUnknownKey":1}');
    expect(has(f, 'settings/unknown-key')).toBe(true);
  });
});

describe('settings rules — clean', () => {
  const good =
    '{"model":"sonnet","permissions":{"allow":["Read"]},"hooks":{"PreToolUse":[{"matcher":"Bash","hooks":[{"type":"command","command":"echo hi","timeout":30}]}]},"includeCoAuthoredBy":true}';
  it('does not flag a valid settings file', () => {
    const f = lintOne(P, good);
    expect(f.filter((x) => x.ruleId.startsWith('settings/'))).toHaveLength(0);
  });

  it('accepts an empty matcher string', () => {
    const f = lintOne(P, '{"hooks":{"Stop":[{"matcher":"","hooks":[{"type":"command","command":"x"}]}]}}');
    expect(has(f, 'settings/hook-matcher-not-string')).toBe(false);
  });

  it('accepts a $schema key', () => {
    const f = lintOne(P, '{"$schema":"https://example.com/schema.json","model":"opus"}');
    expect(has(f, 'settings/unknown-key')).toBe(false);
  });
});

describe('settings autofixes', () => {
  it('migrates an array hooks form into an event-keyed object', () => {
    const out = applyFixes({
      path: P,
      content: '{"hooks":[{"event":"PostToolUse","matcher":"Bash","hooks":[{"type":"command","command":"x"}]}]}',
      kind: 'settings',
    });
    const parsed = parseJson(out);
    expect(parsed.error).toBeUndefined();
    const hooks = (parsed.value as Record<string, unknown>)['hooks'] as Record<string, unknown>;
    expect(Array.isArray(hooks)).toBe(false);
    expect(hooks['PostToolUse']).toBeDefined();
  });

  it('defaults unknown-event array entries to PreToolUse', () => {
    const out = applyFixes({ path: P, content: '{"hooks":[{"matcher":"Bash","hooks":[{"type":"command","command":"x"}]}]}', kind: 'settings' });
    expect(out).toContain('PreToolUse');
  });

  it('coerces an object matcher to a string', () => {
    const out = applyFixes({
      path: P,
      content: '{"hooks":{"PreToolUse":[{"matcher":{"toolName":"Bash"},"hooks":[{"type":"command","command":"x"}]}]}}',
      kind: 'settings',
    });
    const parsed = parseJson(out);
    const hooks = (parsed.value as Record<string, unknown>)['hooks'] as Record<string, unknown[]>;
    const group = (hooks['PreToolUse'] as Array<Record<string, unknown>>)[0];
    expect(group?.['matcher']).toBe('Bash');
  });

  it('fixes an invalid settings model to default', () => {
    const out = applyFixes({ path: P, content: '{"model":"claude-3-5-sonnet-latest"}', kind: 'settings' });
    expect(out).toContain('"model": "default"');
  });
});
