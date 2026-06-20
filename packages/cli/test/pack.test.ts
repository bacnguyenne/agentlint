/**
 * Publishability test: pack the agentlint-core + agentlint-cli tarballs exactly
 * as `npm publish` would, install them into a throwaway project, and run the
 * INSTALLED binary. This proves a real user can `npm install agentlint-cli` (or
 * `npx agentlint-cli`) and that the bundled catalog (`agentlint add`) ships and runs.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execa } from 'execa';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');

let projectDir = '';
let installedBin = '';
const cleanup: string[] = [];

beforeAll(async () => {
  // Build both packages.
  await execa('npm', ['run', 'build', '-w', 'agentlint-core'], { cwd: repoRoot });
  await execa('npm', ['run', 'build', '-w', 'agentlint-cli'], { cwd: repoRoot });

  // Pack the tarballs into a temp dir.
  const packDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentlint-pack-'));
  cleanup.push(packDir);
  const core = (await execa('npm', ['pack', '-w', 'agentlint-core', '--pack-destination', packDir], { cwd: repoRoot })).stdout.trim().split('\n').pop()!;
  const cli = (await execa('npm', ['pack', '-w', 'agentlint-cli', '--pack-destination', packDir], { cwd: repoRoot })).stdout.trim().split('\n').pop()!;

  // Install the tarballs into a fresh project, as a real consumer would.
  projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentlint-consumer-'));
  cleanup.push(projectDir);
  await execa('npm', ['init', '-y'], { cwd: projectDir });
  await execa('npm', ['install', path.join(packDir, core), path.join(packDir, cli)], { cwd: projectDir });
  installedBin = path.join(projectDir, 'node_modules', 'agentlint-cli', 'dist', 'index.js');
}, 240_000);

afterAll(async () => {
  await Promise.all(cleanup.map((d) => fs.rm(d, { recursive: true, force: true }).catch(() => {})));
});

function runInstalled(args: string[], cwd: string) {
  return execa('node', [installedBin, ...args], { reject: false, cwd, env: { ...process.env, NO_COLOR: '1' } });
}

describe('installed package (npm pack -> install)', () => {
  it('exposes the agentlint binary and reports its version', async () => {
    const res = await runInstalled(['--version'], projectDir);
    expect(res.exitCode).toBe(0);
    expect(res.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('ships the catalog: `add --list` works', async () => {
    const res = await runInstalled(['add', '--list'], projectDir);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toMatch(/skills \(\d+\)/);
    expect(res.stdout).toContain('mcp-filesystem');
  });

  it('installs a catalog item and the result lints clean', async () => {
    const proj = await fs.mkdtemp(path.join(os.tmpdir(), 'agentlint-target-'));
    cleanup.push(proj);
    const add = await runInstalled(['add', 'pdf-extract'], proj);
    expect(add.exitCode).toBe(0);
    expect(await fs.access(path.join(proj, '.claude/skills/pdf-extract/SKILL.md')).then(() => true, () => false)).toBe(true);
    const lint = await runInstalled(['.'], proj);
    expect(lint.exitCode).toBe(0);
  });
});
