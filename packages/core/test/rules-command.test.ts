import { describe, it, expect } from 'vitest';
import { lintOne, has } from './helpers.js';
import { applyFixes } from '../src/index.js';

const P = '.claude/commands/deploy.md';

describe('command rules — triggering', () => {
  it('command/invalid-frontmatter on bad YAML', () => {
    const f = lintOne(P, '---\nkey: : :\n  - x\n---\nbody');
    expect(has(f, 'command/invalid-frontmatter')).toBe(true);
  });

  it('command/unknown-key for a disallowed key', () => {
    const f = lintOne(P, '---\ndescription: d\nbogus: 1\n---\nbody');
    expect(has(f, 'command/unknown-key')).toBe(true);
  });

  it('command/empty-body when body blank', () => {
    const f = lintOne(P, '---\ndescription: d\n---\n  ');
    expect(has(f, 'command/empty-body')).toBe(true);
  });

  it('command/empty-body when whole file is blank (no frontmatter)', () => {
    const f = lintOne(P, '   \n  ');
    expect(has(f, 'command/empty-body')).toBe(true);
  });

  it('command/invalid-model for a bad model', () => {
    const f = lintOne(P, '---\ndescription: d\nmodel: gpt-4o\n---\nbody');
    expect(has(f, 'command/invalid-model')).toBe(true);
  });
});

describe('command rules — clean', () => {
  it('accepts a valid command with allowed keys', () => {
    const good = '---\ndescription: Deploy.\nargument-hint: "[env]"\nallowed-tools: Bash(git push:*)\nmodel: default\ndisable-model-invocation: true\n---\n\nDeploy to $1.';
    const f = lintOne(P, good);
    expect(f.filter((x) => x.ruleId.startsWith('command/'))).toHaveLength(0);
  });

  it('accepts a command with no frontmatter but a body', () => {
    const f = lintOne(P, 'Just run the thing with $ARGUMENTS.');
    expect(f.filter((x) => x.ruleId.startsWith('command/'))).toHaveLength(0);
  });

  it('accepts default model alias', () => {
    const f = lintOne(P, '---\ndescription: d\nmodel: default\n---\nbody');
    expect(has(f, 'command/invalid-model')).toBe(false);
  });
});

describe('command autofix', () => {
  it('fixes an invalid model to default', () => {
    const out = applyFixes({ path: P, content: '---\ndescription: d\nmodel: gpt-4o\n---\nbody', kind: 'command' });
    expect(out).toContain('model: default');
  });
});
