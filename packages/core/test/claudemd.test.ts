import { describe, it, expect } from 'vitest';
import { lintOne, has } from './helpers.js';
import { CLAUDEMD_LARGE_CHARS } from '../src/rules/claudemd.js';

describe('claudemd rules', () => {
  it('claudemd/empty for a blank file', () => {
    expect(has(lintOne('CLAUDE.md', '   \n  '), 'claudemd/empty')).toBe(true);
  });

  it('claudemd/too-large for an oversized file', () => {
    const big = 'x'.repeat(CLAUDEMD_LARGE_CHARS + 1);
    expect(has(lintOne('CLAUDE.md', big), 'claudemd/too-large')).toBe(true);
  });

  it('does not flag a reasonable CLAUDE.md', () => {
    const f = lintOne('CLAUDE.md', '# Guidance\n\nUse `${ENV}` for secrets.');
    expect(f.filter((x) => x.ruleId.startsWith('claudemd/'))).toHaveLength(0);
  });
});
