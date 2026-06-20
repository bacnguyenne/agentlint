import { afterAll, describe, expect, it } from 'vitest';
import { execa } from 'execa';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeZip } from '@/lib/zip';

const tmp: string[] = [];
afterAll(async () => {
  await Promise.all(tmp.map((f) => fs.rm(f, { recursive: true, force: true }).catch(() => {})));
});

async function writeZip(bytes: Uint8Array): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentlint-zip-'));
  tmp.push(dir);
  const file = path.join(dir, 'out.zip');
  await fs.writeFile(file, bytes);
  return file;
}

describe('makeZip', () => {
  it('produces a valid archive `unzip -t` accepts', async () => {
    const zip = makeZip([
      { path: '.claude/skills/pdf/SKILL.md', content: '---\nname: pdf\n---\nbody\n' },
      { path: '.mcp.json', content: '{\n  "mcpServers": {}\n}\n' },
    ]);
    const file = await writeZip(zip);
    const res = await execa('unzip', ['-t', file], { reject: false });
    expect(res.exitCode, res.stderr).toBe(0);
    expect(res.stdout).toContain('No errors detected'); // CRCs verified
  });

  it('round-trips file contents exactly', async () => {
    const content = '---\nname: code-reviewer\ndescription: Review. Use when committing.\n---\n\nHello → world.\n';
    const zip = makeZip([{ path: '.claude/agents/code-reviewer.md', content }]);
    const file = await writeZip(zip);
    const res = await execa('unzip', ['-p', file, '.claude/agents/code-reviewer.md']);
    // execa strips one trailing newline from stdout.
    expect(res.stdout).toBe(content.replace(/\n$/, ''));
  });

  it('lists every entry path', async () => {
    const paths = ['.claude/skills/a/SKILL.md', '.claude/agents/b.md', '.claude/commands/c.md', '.mcp.json'];
    const zip = makeZip(paths.map((p) => ({ path: p, content: 'x' })));
    const file = await writeZip(zip);
    const res = await execa('unzip', ['-l', file]);
    for (const p of paths) expect(res.stdout).toContain(p);
  });
});
