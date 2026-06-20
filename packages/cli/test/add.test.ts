/**
 * Integration tests for `agentlint add` — installing catalog items (skills,
 * MCP servers, tools) into a project. Runs the BUILT binary via execa.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execa } from 'execa';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(here, '..');
const repoRoot = path.resolve(cliRoot, '..', '..');
const cliEntry = path.join(cliRoot, 'dist', 'index.js');

function runCli(args: string[], cwd: string) {
  return execa('node', [cliEntry, ...args], { reject: false, cwd, env: { ...process.env, NO_COLOR: '1' } });
}

const tempDirs: string[] = [];
async function makeTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentlint-add-'));
  tempDirs.push(dir);
  return dir;
}
async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

beforeAll(async () => {
  await execa('npm', ['run', 'build', '-w', 'agentlint-core'], { cwd: repoRoot });
  await execa('npm', ['run', 'build', '-w', 'agentlint-cli'], { cwd: repoRoot });
}, 180_000);

afterAll(async () => {
  await Promise.all(tempDirs.map((d) => fs.rm(d, { recursive: true, force: true }).catch(() => {})));
});

describe('agentlint add', () => {
  it('add --list shows skills, mcp, and tools', async () => {
    const dir = await makeTempDir();
    const res = await runCli(['add', '--list'], dir);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toMatch(/skills \(\d+\)/);
    expect(res.stdout).toMatch(/MCP servers \(\d+\)/);
    expect(res.stdout).toMatch(/tools \(\d+\)/);
    expect(res.stdout).toContain('mcp-filesystem');
  });

  it('--dry-run writes nothing', async () => {
    const dir = await makeTempDir();
    const res = await runCli(['add', 'ship-feature', '--dry-run'], dir);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toMatch(/Would write/);
    expect(await exists(path.join(dir, '.claude/skills/ship-feature/SKILL.md'))).toBe(false);
  });

  it('installs a subagent and the result lints clean', async () => {
    const dir = await makeTempDir();
    const add = await runCli(['add', 'ship-feature'], dir);
    expect(add.exitCode).toBe(0);
    expect(await exists(path.join(dir, '.claude/skills/ship-feature/SKILL.md'))).toBe(true);
    const lint = await runCli(['.'], dir);
    expect(lint.exitCode).toBe(0); // no errors
  });

  it('installs a skill by name', async () => {
    const dir = await makeTempDir();
    const res = await runCli(['add', 'pdf-extract'], dir);
    expect(res.exitCode).toBe(0);
    expect(await exists(path.join(dir, '.claude/skills/pdf-extract/SKILL.md'))).toBe(true);
  });

  it('merges multiple MCP servers into one .mcp.json', async () => {
    const dir = await makeTempDir();
    await runCli(['add', 'mcp-filesystem'], dir);
    await runCli(['add', 'mcp-github'], dir);
    const mcp = JSON.parse(await fs.readFile(path.join(dir, '.mcp.json'), 'utf8'));
    expect(Object.keys(mcp.mcpServers).sort()).toEqual(['filesystem', 'github']);
  });

  it('refuses an unknown id (exit 2)', async () => {
    const dir = await makeTempDir();
    const res = await runCli(['add', 'does-not-exist'], dir);
    expect(res.exitCode).toBe(2);
    expect(res.stderr).toMatch(/no catalog item/);
  });

  it('does not overwrite an existing file without --force', async () => {
    const dir = await makeTempDir();
    await runCli(['add', 'conventional-commits'], dir);
    const second = await runCli(['add', 'conventional-commits'], dir);
    expect(second.exitCode).toBe(2);
    expect(second.stderr).toMatch(/already exists/);
    const forced = await runCli(['add', 'conventional-commits', '--force'], dir);
    expect(forced.exitCode).toBe(0);
  });

  it('add with no id and no --list is a usage error', async () => {
    const dir = await makeTempDir();
    const res = await runCli(['add'], dir);
    expect(res.exitCode).toBe(2);
  });
});
