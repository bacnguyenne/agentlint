import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { discoverFiles, classifyPath, lintDirectory } from '../src/index.js';
import { compileIgnore } from '../src/discover.js';

describe('classifyPath', () => {
  it('classifies each kind', () => {
    expect(classifyPath('.mcp.json')).toBe('mcp');
    expect(classifyPath('repo/.mcp.json')).toBe('mcp');
    expect(classifyPath('.claude/settings.json')).toBe('settings');
    expect(classifyPath('.claude/settings.local.json')).toBe('settings');
    expect(classifyPath('CLAUDE.md')).toBe('claudemd');
    expect(classifyPath('sub/CLAUDE.md')).toBe('claudemd');
    expect(classifyPath('.claude/agents/foo.md')).toBe('agent');
    expect(classifyPath('.claude/commands/ns/foo.md')).toBe('command');
    expect(classifyPath('.claude/skills/pdf/SKILL.md')).toBe('skill');
    expect(classifyPath('.claude/skills/pdf/skill.md')).toBe('skill'); // case-variant discovered (flagged by a rule)
    expect(classifyPath('README.md')).toBe('unknown');
    expect(classifyPath('settings.json')).toBe('unknown'); // not under .claude
    expect(classifyPath('.claude\\agents\\foo.md')).toBe('agent'); // windows sep
  });
});

describe('compileIgnore', () => {
  it('matches simple globs', () => {
    expect(compileIgnore('*.md')('foo.md')).toBe(true);
    expect(compileIgnore('*.md')('a/foo.md')).toBe(true);
    expect(compileIgnore('node_modules')('node_modules')).toBe(true);
    expect(compileIgnore('node_modules')('node_modules/x/y')).toBe(true);
    expect(compileIgnore('/root.md')('root.md')).toBe(true);
    expect(compileIgnore('/root.md')('a/root.md')).toBe(false);
    expect(compileIgnore('**/foo')('a/b/foo')).toBe(true);
    expect(compileIgnore('docs/')('docs')).toBe(true);
    expect(compileIgnore('')('anything')).toBe(false);
    expect(compileIgnore('# comment')('anything')).toBe(false);
  });

  // Regression (fix 9): the dirOnly suffix had two identical branches; removing
  // the dead code must keep `dist/` and `dist` behaving identically — both
  // match the directory itself and anything beneath it.
  it('treats a trailing-slash dir pattern identically to a plain one', () => {
    for (const pat of ['dist', 'dist/']) {
      expect(compileIgnore(pat)('dist')).toBe(true);
      expect(compileIgnore(pat)('dist/a/b.js')).toBe(true);
      expect(compileIgnore(pat)('src/dist')).toBe(true);
      expect(compileIgnore(pat)('distinct')).toBe(false);
    }
  });
});

describe('discoverFiles (temp dir)', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentlint-'));
    await fs.mkdir(path.join(dir, '.claude/agents'), { recursive: true });
    await fs.mkdir(path.join(dir, '.claude/commands/ns'), { recursive: true });
    await fs.mkdir(path.join(dir, '.claude/skills/pdf'), { recursive: true });
    await fs.mkdir(path.join(dir, 'node_modules/pkg'), { recursive: true });
    await fs.mkdir(path.join(dir, 'sub'), { recursive: true });

    await fs.writeFile(path.join(dir, 'CLAUDE.md'), '# root');
    await fs.writeFile(path.join(dir, 'sub/CLAUDE.md'), '# nested');
    await fs.writeFile(path.join(dir, '.mcp.json'), '{"mcpServers":{}}');
    await fs.writeFile(path.join(dir, '.claude/settings.json'), '{}');
    await fs.writeFile(path.join(dir, '.claude/settings.local.json'), '{}');
    await fs.writeFile(path.join(dir, '.claude/agents/a.md'), '---\nname: a\ndescription: d\n---\nbody');
    await fs.writeFile(path.join(dir, '.claude/commands/ns/c.md'), 'cmd body');
    await fs.writeFile(
      path.join(dir, '.claude/skills/pdf/SKILL.md'),
      '---\nname: pdf\ndescription: Use when working with PDFs.\n---\nbody',
    );
    // Noise that must be ignored.
    await fs.writeFile(path.join(dir, 'README.md'), 'readme');
    await fs.writeFile(path.join(dir, 'node_modules/pkg/CLAUDE.md'), 'should be skipped');
  });

  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('finds all known files and classifies them', async () => {
    const files = await discoverFiles(dir);
    const byKind = new Map(files.map((f) => [f.path, f.kind]));
    expect(byKind.get('CLAUDE.md')).toBe('claudemd');
    expect(byKind.get('sub/CLAUDE.md')).toBe('claudemd');
    expect(byKind.get('.mcp.json')).toBe('mcp');
    expect(byKind.get('.claude/settings.json')).toBe('settings');
    expect(byKind.get('.claude/settings.local.json')).toBe('settings');
    expect(byKind.get('.claude/agents/a.md')).toBe('agent');
    expect(byKind.get('.claude/commands/ns/c.md')).toBe('command');
    expect(byKind.get('.claude/skills/pdf/SKILL.md')).toBe('skill');
  });

  it('skips node_modules and unrelated files', async () => {
    const files = await discoverFiles(dir);
    expect(files.some((f) => f.path.includes('node_modules'))).toBe(false);
    expect(files.some((f) => f.path === 'README.md')).toBe(false);
  });

  it('respects an explicit ignore pattern', async () => {
    const files = await discoverFiles(dir, ['sub/']);
    expect(files.some((f) => f.path === 'sub/CLAUDE.md')).toBe(false);
    expect(files.some((f) => f.path === 'CLAUDE.md')).toBe(true);
  });

  it('returns an empty list for a non-existent directory', async () => {
    const files = await discoverFiles(path.join(dir, 'does-not-exist'));
    expect(files).toEqual([]);
  });

  it('lintDirectory runs end-to-end over the temp dir', async () => {
    const result = await lintDirectory(dir);
    expect(result.summary.filesChecked).toBeGreaterThanOrEqual(7);
    expect(Array.isArray(result.findings)).toBe(true);
  });

  it('lintDirectory finds problems in files that have them', async () => {
    // Write a clearly-broken mcp config and re-scan.
    await fs.writeFile(path.join(dir, '.mcp.json'), '{"mcpServers":[]}');
    const result = await lintDirectory(dir);
    expect(result.findings.some((f) => f.ruleId === 'mcp/mcpservers-is-array')).toBe(true);
  });
});

describe('discoverFiles oversized + in-root symlinks', () => {
  it('skips a file larger than the size cap', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'agentlint-big-'));
    // 1 MiB + 1 byte exceeds MAX_FILE_BYTES.
    await fs.writeFile(path.join(base, 'CLAUDE.md'), 'x'.repeat(1024 * 1024 + 1));
    const files = await discoverFiles(base);
    expect(files.some((f) => f.path === 'CLAUDE.md')).toBe(false);
    await fs.rm(base, { recursive: true, force: true });
  });

  it('follows a symlink to a file that stays inside the root', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'agentlint-insym-'));
    await fs.writeFile(path.join(base, 'real.md'), '# real');
    try {
      // Link name classifies as CLAUDE.md so discovery picks it up.
      await fs.symlink(path.join(base, 'real.md'), path.join(base, 'CLAUDE.md'), 'file');
    } catch {
      await fs.rm(base, { recursive: true, force: true });
      return;
    }
    const files = await discoverFiles(base);
    expect(files.some((f) => f.path === 'CLAUDE.md')).toBe(true);
    await fs.rm(base, { recursive: true, force: true });
  });

  it('follows a symlinked directory that stays inside the root', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'agentlint-indir-'));
    await fs.mkdir(path.join(base, 'inner'), { recursive: true });
    await fs.writeFile(path.join(base, 'inner/CLAUDE.md'), '# inner');
    try {
      await fs.symlink(path.join(base, 'inner'), path.join(base, 'linked'), 'dir');
    } catch {
      await fs.rm(base, { recursive: true, force: true });
      return;
    }
    const files = await discoverFiles(base);
    expect(files.some((f) => f.path === 'linked/CLAUDE.md')).toBe(true);
    await fs.rm(base, { recursive: true, force: true });
  });
});

describe('discoverFiles symlink safety', () => {
  it('does not follow a symlink pointing outside the root', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'agentlint-sym-'));
    const root = path.join(base, 'root');
    const outside = path.join(base, 'outside');
    await fs.mkdir(root, { recursive: true });
    await fs.mkdir(outside, { recursive: true });
    await fs.writeFile(path.join(outside, 'CLAUDE.md'), 'secret outside');
    await fs.writeFile(path.join(root, 'CLAUDE.md'), 'inside');
    try {
      await fs.symlink(outside, path.join(root, 'link'), 'dir');
    } catch {
      // Symlink creation may be unavailable; skip assertion in that case.
      await fs.rm(base, { recursive: true, force: true });
      return;
    }
    const files = await discoverFiles(root);
    expect(files.some((f) => f.path === 'CLAUDE.md')).toBe(true);
    expect(files.some((f) => f.path.includes('link'))).toBe(false);
    await fs.rm(base, { recursive: true, force: true });
  });
});
