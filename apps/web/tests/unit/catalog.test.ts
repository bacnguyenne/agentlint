import { describe, it, expect } from 'vitest';
import { lintFiles } from 'agentlint-core';
import { CATALOG, CATALOG_COUNTS, MCP_CATALOG, TOOL_CATALOG } from '@/lib/catalog';

/**
 * The unified discovery catalog (skills + MCP servers + tools) must be safe to
 * copy/download: every item is validated by agentlint and must have ZERO errors.
 */
describe('discovery catalog', () => {
  it('is non-empty and counts add up', () => {
    expect(CATALOG.length).toBeGreaterThan(0);
    expect(CATALOG_COUNTS.skill + CATALOG_COUNTS.mcp + CATALOG_COUNTS.tool).toBe(CATALOG.length);
    expect(MCP_CATALOG.length).toBeGreaterThan(0);
    expect(TOOL_CATALOG.length).toBeGreaterThan(0);
  });

  it('has unique ids and the required fields', () => {
    const ids = new Set<string>();
    for (const i of CATALOG) {
      expect(ids.has(i.id), `duplicate id ${i.id}`).toBe(false);
      ids.add(i.id);
      expect(i.name && i.title && i.description && i.content && i.targetPath, `${i.id} fields`).toBeTruthy();
      expect(['skill', 'mcp', 'tool']).toContain(i.kind);
      expect(['skill', 'mcp', 'agent', 'command']).toContain(i.configKind);
    }
  });

  it('contains no hardcoded secrets (env refs only)', () => {
    for (const i of CATALOG) {
      // A literal token would be caught by security/hardcoded-secret below, but
      // assert the obvious shape too: any secret-ish value is a ${ENV} ref.
      expect(/sk-[A-Za-z0-9]{16}|ghp_[A-Za-z0-9]{20}|AKIA[0-9A-Z]{16}/.test(i.content), `${i.id} literal secret`).toBe(false);
    }
  });

  for (const item of CATALOG) {
    it(`"${item.id}" lints with zero errors`, () => {
      const result = lintFiles([{ path: item.targetPath, content: item.content, kind: item.configKind }]);
      const errors = result.findings.filter((f) => f.severity === 'error');
      expect(errors, `${item.id} errors: ${JSON.stringify(errors)}`).toHaveLength(0);
    });
  }
});
