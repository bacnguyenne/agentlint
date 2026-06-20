import { describe, it, expect } from 'vitest';
import { lintOne, has } from './helpers.js';
import { applyFixes, slugifyName } from '../src/index.js';

const P = '.claude/agents/reviewer.md';

describe('agent rules — triggering', () => {
  it('agent/missing-frontmatter when there is no fence', () => {
    expect(has(lintOne(P, 'just a body, no frontmatter'), 'agent/missing-frontmatter')).toBe(true);
  });

  it('agent/missing-name when name is absent', () => {
    const f = lintOne(P, '---\ndescription: x\n---\nbody');
    expect(has(f, 'agent/missing-name')).toBe(true);
  });

  it('agent/invalid-name for uppercase/underscores', () => {
    const f = lintOne('.claude/agents/Bad_Name.md', '---\nname: Bad_Name\ndescription: d\n---\nbody');
    expect(has(f, 'agent/invalid-name')).toBe(true);
  });

  it('agent/name-filename-mismatch when name != basename', () => {
    const f = lintOne('.claude/agents/reviewer.md', '---\nname: other\ndescription: d\n---\nbody');
    expect(has(f, 'agent/name-filename-mismatch')).toBe(true);
  });

  it('agent/missing-description when description empty', () => {
    const f = lintOne(P, '---\nname: reviewer\ndescription: "  "\n---\nbody');
    expect(has(f, 'agent/missing-description')).toBe(true);
  });

  it('agent/unknown-tool for an unrecognized tool', () => {
    const f = lintOne(P, '---\nname: reviewer\ndescription: d\ntools: Read, Frobnicate\n---\nbody');
    expect(has(f, 'agent/unknown-tool')).toBe(true);
  });

  it('agent/invalid-model for a -latest id', () => {
    const f = lintOne(P, '---\nname: reviewer\ndescription: d\nmodel: claude-3-5-sonnet-latest\n---\nbody');
    expect(has(f, 'agent/invalid-model')).toBe(true);
  });

  it('agent/invalid-model for a non-claude id', () => {
    const f = lintOne(P, '---\nname: reviewer\ndescription: d\nmodel: gpt-4o\n---\nbody');
    expect(has(f, 'agent/invalid-model')).toBe(true);
  });

  it('agent/empty-body when body is blank', () => {
    const f = lintOne(P, '---\nname: reviewer\ndescription: d\n---\n   \n');
    expect(has(f, 'agent/empty-body')).toBe(true);
  });

  // Regression (fix 3): an EMPTY frontmatter block (present fences, no keys)
  // must fire BOTH missing-name and missing-description — not be silently
  // skipped because `fm.data` is undefined.
  it('fires missing-name and missing-description for an empty frontmatter block', () => {
    const f = lintOne(P, '---\n---\nBody');
    expect(has(f, 'agent/missing-name')).toBe(true);
    expect(has(f, 'agent/missing-description')).toBe(true);
    // "No frontmatter at all" should NOT be reported — the fences are present.
    expect(has(f, 'agent/missing-frontmatter')).toBe(false);
  });
});

describe('agent rules — clean (no false positives)', () => {
  const good = '---\nname: reviewer\ndescription: Reviews code.\ntools: Read, Grep, mcp__srv__tool\nmodel: sonnet\n---\n\nYou review code.';
  it('does not flag a valid agent', () => {
    const f = lintOne(P, good);
    expect(f.filter((x) => x.ruleId.startsWith('agent/'))).toHaveLength(0);
  });

  it('accepts a YAML-list tools form', () => {
    const f = lintOne(P, '---\nname: reviewer\ndescription: d\ntools:\n  - Read\n  - Write\n---\nbody');
    expect(has(f, 'agent/unknown-tool')).toBe(false);
  });

  it('accepts a pinned claude-* model', () => {
    const f = lintOne(P, '---\nname: reviewer\ndescription: d\nmodel: claude-3-5-sonnet-20241022\n---\nbody');
    expect(has(f, 'agent/invalid-model')).toBe(false);
  });

  it('accepts inherit/opus/sonnet/haiku aliases', () => {
    for (const m of ['inherit', 'opus', 'sonnet', 'haiku']) {
      const f = lintOne(P, `---\nname: reviewer\ndescription: d\nmodel: ${m}\n---\nbody`);
      expect(has(f, 'agent/invalid-model')).toBe(false);
    }
  });
});

describe('slugifyName', () => {
  it('slugifies names with invalid chars', () => {
    expect(slugifyName('Bad_Name 2')).toBe('bad-name-2');
    expect(slugifyName('  Hello!!  ')).toBe('hello');
    expect(slugifyName('123abc')).toBe('agent-123abc');
    expect(slugifyName('!!!')).toBe('agent');
  });
});

describe('agent autofixes', () => {
  it('fixes an invalid name to a slug (then aligns to filename)', () => {
    // File basename is `bad-name`, so invalid-name slugifies Bad_Name -> bad-name
    // and the (already-matching) filename keeps it stable.
    const out = applyFixes({ path: '.claude/agents/bad-name.md', content: '---\nname: Bad_Name\ndescription: d\n---\nbody', kind: 'agent' });
    expect(out).toContain('name: bad-name');
  });

  it('slugify fix on a mismatched filename converges to the basename', () => {
    const out = applyFixes({ path: '.claude/agents/foo.md', content: '---\nname: Bad_Name\ndescription: d\n---\nbody', kind: 'agent' });
    // invalid-name -> bad-name, then name-filename-mismatch -> foo.
    expect(out).toContain('name: foo');
  });

  it('fixes a name/filename mismatch to the basename', () => {
    const out = applyFixes({ path: '.claude/agents/reviewer.md', content: '---\nname: other\ndescription: d\n---\nbody', kind: 'agent' });
    expect(out).toContain('name: reviewer');
  });

  it('fixes an invalid model to inherit', () => {
    const out = applyFixes({ path: P, content: '---\nname: reviewer\ndescription: d\nmodel: gpt-4o\n---\nbody', kind: 'agent' });
    expect(out).toContain('model: inherit');
  });
});
