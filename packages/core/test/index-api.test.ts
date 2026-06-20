import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  lintDirectory,
  lintDirectoryWithFixes,
  lintFiles,
  parseFrontmatter,
  parseJson,
  normalizeText,
} from '../src/index.js';

describe('public API re-exports', () => {
  it('exposes parser helpers', () => {
    expect(parseFrontmatter('---\nname: x\n---\nb').data).toEqual({ name: 'x' });
    expect(parseJson('{"a":1}').value).toEqual({ a: 1 });
    expect(normalizeText('a\r\nb')).toBe('a\nb');
  });

  it('lintFiles is pure and returns a result', () => {
    const r = lintFiles([{ path: '.mcp.json', content: '{"mcpServers":{}}' }]);
    expect(r.summary.filesChecked).toBe(1);
  });
});

describe('lintDirectory + lintDirectoryWithFixes', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentlint-api-'));
    await fs.mkdir(path.join(dir, '.claude/agents'), { recursive: true });
    await fs.writeFile(path.join(dir, '.claude/agents/Bad_Name.md'), '---\nname: Bad_Name\ndescription: d\nmodel: gpt-4o\n---\nbody');
  });
  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('lintDirectory reports findings on disk', async () => {
    const r = await lintDirectory(dir);
    expect(r.findings.some((f) => f.ruleId === 'agent/invalid-name')).toBe(true);
    expect(r.findings.some((f) => f.ruleId === 'agent/invalid-model')).toBe(true);
  });

  it('lintDirectoryWithFixes returns patched contents', async () => {
    const { result, fixedFiles } = await lintDirectoryWithFixes(dir, { fix: true });
    const patched = fixedFiles.get('.claude/agents/Bad_Name.md');
    expect(patched).toBeDefined();
    expect(patched).toContain('model: inherit');
    // After fix, the invalid-model finding is gone.
    expect(result.findings.some((f) => f.ruleId === 'agent/invalid-model')).toBe(false);
  });

  it('honors an ignore pattern in options', async () => {
    const r = await lintDirectory(dir, { ignore: ['**/Bad_Name.md'] });
    expect(r.findings.some((f) => f.ruleId === 'agent/invalid-name')).toBe(false);
  });
});
