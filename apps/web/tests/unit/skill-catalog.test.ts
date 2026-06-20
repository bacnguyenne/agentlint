import { describe, it, expect } from 'vitest';
import { lintFiles } from 'agentlint-core';
import { SKILL_CATALOG } from '@/lib/skill-catalog';

/**
 * The curated catalog is produced by `scripts/sync-skills.mjs`, which only keeps
 * skills agentlint passes with zero errors. This test is the CI guard that the
 * invariant holds for whatever is committed (so a bad sync can never ship).
 */
describe('curated skill catalog', () => {
  it('is non-empty (seeds guarantee at least the bundled skills)', () => {
    expect(SKILL_CATALOG.length).toBeGreaterThan(0);
  });

  it('has unique ids and the required fields', () => {
    const ids = new Set<string>();
    for (const s of SKILL_CATALOG) {
      expect(s.id, 'id').toBeTruthy();
      expect(ids.has(s.id), `duplicate id ${s.id}`).toBe(false);
      ids.add(s.id);
      expect(s.name, `${s.id} name`).toBeTruthy();
      expect(s.description, `${s.id} description`).toBeTruthy();
      expect(s.content, `${s.id} content`).toBeTruthy();
      expect(s.source, `${s.id} source`).toBeTruthy();
    }
  });

  for (const s of SKILL_CATALOG) {
    it(`"${s.id}" lints with zero errors`, () => {
      const result = lintFiles([
        { path: `.claude/skills/${s.name}/SKILL.md`, content: s.content, kind: 'skill' },
      ]);
      const errors = result.findings.filter((f) => f.severity === 'error');
      expect(errors, `${s.id} errors: ${JSON.stringify(errors)}`).toHaveLength(0);
    });
  }
});
