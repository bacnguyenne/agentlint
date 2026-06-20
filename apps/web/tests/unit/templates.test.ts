import { describe, it, expect } from 'vitest';
import { lintFiles } from 'agentlint-core';
import { TEMPLATES } from '@/lib/templates';
import { EXAMPLES } from '@/lib/examples';
import { pathForKind } from '@/lib/detect-kind';

describe('templates gallery correctness', () => {
  // Every shipped template must be CORRECT: zero findings of any severity.
  for (const t of TEMPLATES) {
    it(`template "${t.id}" lints with zero findings`, () => {
      const result = lintFiles([{ path: t.filename, content: t.content, kind: t.kind }]);
      expect(
        result.findings,
        `template ${t.id} produced findings: ${JSON.stringify(result.findings)}`,
      ).toHaveLength(0);
    });
  }
});

describe('examples behave as labeled', () => {
  // A "clean" example MUST pass with zero findings (it shows users the green ✓
  // result); every other example MUST actually trip rules, or the demo lies.
  for (const ex of EXAMPLES) {
    if (ex.clean) {
      it(`clean example "${ex.id}" produces zero findings`, () => {
        const result = lintFiles([{ path: pathForKind(ex.kind), content: ex.content, kind: ex.kind }]);
        expect(
          result.findings,
          `clean example ${ex.id} produced findings: ${JSON.stringify(result.findings)}`,
        ).toHaveLength(0);
      });
    } else {
      it(`example "${ex.id}" produces at least one error`, () => {
        const result = lintFiles([{ path: pathForKind(ex.kind), content: ex.content, kind: ex.kind }]);
        expect(result.summary.errors).toBeGreaterThan(0);
      });
    }
  }
});
