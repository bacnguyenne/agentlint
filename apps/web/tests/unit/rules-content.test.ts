import { describe, it, expect } from 'vitest';
import { lintFiles } from 'agentlint-core';
import { RULE_CONTENT } from '@/lib/rules-content';
import { pathForKind, type SelectableKind } from '@/lib/detect-kind';

/** Rule ids surfaced when linting `content` as `kind` (using the same path the
 * validator uses for pasted text, so this matches what users see). */
function ruleIds(content: string, kind: SelectableKind): string[] {
  return lintFiles([{ path: pathForKind(kind), content, kind }]).findings.map((f) => f.ruleId);
}

describe('rules-content examples are accurate (CI guard)', () => {
  for (const [ruleId, c] of Object.entries(RULE_CONTENT)) {
    if (!c.demoable) continue;
    it(`${ruleId}: bad example triggers it, good example passes`, () => {
      expect(c.bad, `${ruleId} is demoable but has no bad example`).toBeDefined();
      expect(c.good, `${ruleId} is demoable but has no good example`).toBeDefined();
      // The flagged example must actually trip THIS rule.
      expect(ruleIds(c.bad!.content, c.bad!.kind)).toContain(ruleId);
      // The fixed example must no longer trip it.
      expect(ruleIds(c.good!.content, c.good!.kind)).not.toContain(ruleId);
    });
  }

  it('covers every rule in the catalog', async () => {
    const { rules } = await import('agentlint-core');
    for (const r of rules) {
      expect(RULE_CONTENT[r.id], `RULE_CONTENT missing entry for ${r.id}`).toBeDefined();
    }
  });
});
