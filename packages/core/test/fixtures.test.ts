import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintDirectory } from '../src/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesRoot = path.resolve(here, '../../../fixtures');

describe('fixtures/good', () => {
  it('produces no error-severity findings', async () => {
    const result = await lintDirectory(path.join(fixturesRoot, 'good'));
    const errors = result.findings.filter((f) => f.severity === 'error');
    expect(errors).toEqual([]);
  });
});

describe('fixtures/bad', () => {
  it('triggers the expected representative rules', async () => {
    const result = await lintDirectory(path.join(fixturesRoot, 'bad'));
    const ids = new Set(result.findings.map((f) => f.ruleId));
    // A representative spread across groups.
    for (const expected of [
      'agent/invalid-name',
      'agent/invalid-model',
      'command/unknown-key',
      'skill/invalid-name',
      'skill/filename-not-canonical',
      'settings/hooks-unknown-event',
      'settings/hook-matcher-not-string',
      'security/broad-permissions',
      'security/hardcoded-secret',
      'security/dangerous-hook-command',
      'security/remote-code-execution',
      'mcp/mcpservers-is-array',
    ]) {
      expect(ids.has(expected), `expected ${expected}`).toBe(true);
    }
    expect(result.summary.errors).toBeGreaterThan(0);
  });
});
