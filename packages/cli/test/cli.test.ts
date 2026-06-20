/**
 * Integration tests for the agentlint CLI.
 *
 * These run the BUILT binary (`dist/index.js`) via execa, exactly as a user or
 * CI would. The CLI is built once in `beforeAll`. Filesystem-mutating tests
 * (`--fix`, `init`) operate on temp copies so fixtures stay pristine.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execa } from 'execa';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(here, '..'); // packages/cli
const repoRoot = path.resolve(cliRoot, '..', '..');
const cliEntry = path.join(cliRoot, 'dist', 'index.js');
const goodFixture = path.join(repoRoot, 'fixtures', 'good');
const badFixture = path.join(repoRoot, 'fixtures', 'bad');

/** Run the built CLI. `reject:false` so we can assert on non-zero exits. */
function runCli(args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) {
  return execa('node', [cliEntry, ...args], {
    reject: false,
    cwd: opts.cwd ?? repoRoot,
    env: { ...process.env, NO_COLOR: '1', ...opts.env },
  });
}

const tempDirs: string[] = [];

async function makeTempCopy(src: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentlint-test-'));
  tempDirs.push(dir);
  await fs.cp(src, dir, { recursive: true });
  return dir;
}

async function makeTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentlint-test-'));
  tempDirs.push(dir);
  return dir;
}

beforeAll(async () => {
  // Ensure the core is built (the CLI imports its dist), then build the CLI.
  await execa('npm', ['run', 'build', '-w', 'agentlint-core'], { cwd: repoRoot });
  await execa('npm', ['run', 'build', '-w', 'agentlint-cli'], { cwd: repoRoot });
}, 120_000);

afterAll(async () => {
  await Promise.all(
    tempDirs.map((d) => fs.rm(d, { recursive: true, force: true }).catch(() => {})),
  );
});

describe('exit codes & basic linting', () => {
  it('exits 0 on a clean directory', async () => {
    const res = await runCli([goodFixture]);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('No problems found');
  });

  it('exits 1 and reports findings on a bad directory', async () => {
    const res = await runCli([badFixture]);
    expect(res.exitCode).toBe(1);
    // Spot-check a few representative findings across file kinds.
    expect(res.stdout).toContain('agent/invalid-name');
    expect(res.stdout).toContain('security/hardcoded-secret');
    expect(res.stdout).toContain('mcp/mcpservers-is-array');
    expect(res.stdout).toMatch(/✖ \d+ errors/);
  });

  it('defaults to linting the current directory when no path is given', async () => {
    const res = await runCli([], { cwd: goodFixture });
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('No problems found');
  });

  it('merges findings across multiple paths', async () => {
    const res = await runCli([goodFixture, badFixture]);
    expect(res.exitCode).toBe(1);
    // Findings from the bad fixture are present and path-prefixed.
    expect(res.stdout).toContain(badFixture);
  });
});

describe('--format json', () => {
  it('produces valid, parseable JSON matching the LintResult shape', async () => {
    const res = await runCli([badFixture, '--format', 'json']);
    expect(res.exitCode).toBe(1);

    const parsed = JSON.parse(res.stdout) as {
      findings: Array<Record<string, unknown>>;
      summary: { errors: number; warnings: number; infos: number; filesChecked: number };
    };

    expect(Array.isArray(parsed.findings)).toBe(true);
    expect(parsed.findings.length).toBeGreaterThan(0);
    expect(parsed.summary).toMatchObject({
      errors: expect.any(Number),
      warnings: expect.any(Number),
      infos: expect.any(Number),
      filesChecked: expect.any(Number),
    });
    expect(parsed.summary.errors).toBeGreaterThan(0);

    const f = parsed.findings[0]!;
    expect(f).toHaveProperty('ruleId');
    expect(f).toHaveProperty('severity');
    expect(f).toHaveProperty('message');
    expect(f).toHaveProperty('file');
    expect(f).toHaveProperty('fixable');
    expect(f).toHaveProperty('docsSlug');
  });

  it('emits clean JSON on a good directory', async () => {
    const res = await runCli([goodFixture, '--format', 'json']);
    expect(res.exitCode).toBe(0);
    const parsed = JSON.parse(res.stdout) as { findings: unknown[] };
    expect(parsed.findings).toEqual([]);
  });

  it('accepts --format=json (equals syntax)', async () => {
    const res = await runCli([badFixture, '--format=json']);
    expect(res.exitCode).toBe(1);
    expect(() => JSON.parse(res.stdout)).not.toThrow();
  });
});

describe('--fix', () => {
  it('rewrites files, reduces findings, and is idempotent', async () => {
    const dir = await makeTempCopy(badFixture);

    // Snapshot one file we expect to change.
    const settingsPath = path.join(dir, '.claude', 'settings.json');
    const before = await fs.readFile(settingsPath, 'utf8');

    // Baseline error count before fixing.
    const baseline = await runCli([dir, '--format', 'json']);
    const baselineErrors = (JSON.parse(baseline.stdout) as { summary: { errors: number } })
      .summary.errors;

    // First fix run.
    const firstFix = await runCli([dir, '--fix', '--format', 'json']);
    const afterFirst = JSON.parse(firstFix.stdout) as {
      summary: { errors: number };
      fixed: number;
    };
    expect(afterFirst.fixed).toBeGreaterThan(0);
    expect(afterFirst.summary.errors).toBeLessThan(baselineErrors);

    // A file was actually rewritten on disk.
    const after = await fs.readFile(settingsPath, 'utf8');
    expect(after).not.toBe(before);

    // Idempotency: second fix run changes nothing further.
    const snapshot = await fs.readFile(settingsPath, 'utf8');
    const secondFix = await runCli([dir, '--fix', '--format', 'json']);
    const afterSecond = JSON.parse(secondFix.stdout) as {
      summary: { errors: number };
      fixed: number;
    };
    expect(afterSecond.fixed).toBe(0);
    expect(afterSecond.summary.errors).toBe(afterFirst.summary.errors);
    expect(await fs.readFile(settingsPath, 'utf8')).toBe(snapshot);
  });
});

describe('--max-warnings', () => {
  it('exits 1 on a warning-only directory with --max-warnings 0', async () => {
    // Build a directory whose only finding is a warning (unknown tool).
    const dir = await makeTempDir();
    const agentsDir = path.join(dir, '.claude', 'agents');
    await fs.mkdir(agentsDir, { recursive: true });
    await fs.writeFile(
      path.join(agentsDir, 'helper.md'),
      [
        '---',
        'name: helper',
        'description: A helper subagent for tests.',
        'tools: Read, Frobnicate',
        'model: sonnet',
        '---',
        '',
        'You are a helper. Do helpful things.',
        '',
      ].join('\n'),
      'utf8',
    );

    // Sanity: without the threshold this is a warning-only pass (exit 0).
    const baseline = await runCli([dir]);
    expect(baseline.exitCode).toBe(0);
    expect(baseline.stdout).toContain('agent/unknown-tool');

    // With --max-warnings 0 the warning trips a failure.
    const strict = await runCli([dir, '--max-warnings', '0']);
    expect(strict.exitCode).toBe(1);
  });

  it('rejects a negative --max-warnings value (usage error)', async () => {
    const res = await runCli([goodFixture, '--max-warnings', '-1']);
    expect(res.exitCode).toBe(2);
    expect(res.stderr).toContain('--max-warnings');
  });
});

describe('--quiet', () => {
  it('suppresses warnings and infos', async () => {
    const res = await runCli([badFixture, '--quiet', '--format', 'json']);
    expect(res.exitCode).toBe(1);
    const parsed = JSON.parse(res.stdout) as {
      findings: Array<{ severity: string }>;
    };
    expect(parsed.findings.length).toBeGreaterThan(0);
    expect(parsed.findings.every((f) => f.severity === 'error')).toBe(true);
  });
});

describe('help & version', () => {
  it('--help exits 0 with usage text', async () => {
    const res = await runCli(['--help']);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('Usage:');
    expect(res.stdout).toContain('--fix');
  });

  it('--version exits 0 with a semver string', async () => {
    const res = await runCli(['--version']);
    expect(res.exitCode).toBe(0);
    expect(res.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('usage / IO errors (exit 2)', () => {
  it('unknown flag exits 2', async () => {
    const res = await runCli(['--definitely-not-a-flag']);
    expect(res.exitCode).toBe(2);
    expect(res.stderr).toContain('Unknown option');
  });

  it('nonexistent path exits 2', async () => {
    const res = await runCli([path.join(repoRoot, 'this-path-does-not-exist-xyz')]);
    expect(res.exitCode).toBe(2);
    expect(res.stderr).toMatch(/no such file or directory/);
  });

  it('invalid --format value exits 2', async () => {
    const res = await runCli([goodFixture, '--format', 'xml']);
    expect(res.exitCode).toBe(2);
    expect(res.stderr).toContain('Invalid --format');
  });

  it('malformed .agentlintrc.json exits 2', async () => {
    const dir = await makeTempCopy(goodFixture);
    await fs.writeFile(path.join(dir, '.agentlintrc.json'), '{ not valid json ', 'utf8');
    const res = await runCli([dir], { cwd: dir });
    expect(res.exitCode).toBe(2);
    expect(res.stderr).toContain('Invalid JSON');
  });
});

describe('configuration', () => {
  it('honors rule severity overrides from .agentlintrc.json', async () => {
    const dir = await makeTempCopy(badFixture);
    await fs.writeFile(
      path.join(dir, '.agentlintrc.json'),
      JSON.stringify({ rules: { 'security/hardcoded-secret': 'off' } }, null, 2),
      'utf8',
    );
    const res = await runCli([dir], { cwd: dir, env: { NO_COLOR: '1' } });
    // Still has other errors, but the disabled rule is gone.
    expect(res.stdout).not.toContain('security/hardcoded-secret');
    expect(res.stdout).toContain('agent/invalid-name');
  });
});

describe('init subcommand', () => {
  it('writes a starter .agentlintrc.json', async () => {
    const dir = await makeTempDir();
    const res = await runCli(['init'], { cwd: dir });
    expect(res.exitCode).toBe(0);
    const written = await fs.readFile(path.join(dir, '.agentlintrc.json'), 'utf8');
    const parsed = JSON.parse(written) as { rules: unknown; ignore: unknown };
    expect(parsed).toHaveProperty('rules');
    expect(parsed).toHaveProperty('ignore');
  });

  it('refuses to overwrite an existing config without --force', async () => {
    const dir = await makeTempDir();
    await fs.writeFile(path.join(dir, '.agentlintrc.json'), '{"rules":{}}', 'utf8');
    const res = await runCli(['init'], { cwd: dir });
    expect(res.exitCode).toBe(2);
    expect(res.stderr).toContain('already exists');
    // Original content preserved.
    expect(await fs.readFile(path.join(dir, '.agentlintrc.json'), 'utf8')).toBe(
      '{"rules":{}}',
    );
  });

  it('overwrites with --force', async () => {
    const dir = await makeTempDir();
    await fs.writeFile(path.join(dir, '.agentlintrc.json'), '{"rules":{}}', 'utf8');
    const res = await runCli(['init', '--force'], { cwd: dir });
    expect(res.exitCode).toBe(0);
    const written = await fs.readFile(path.join(dir, '.agentlintrc.json'), 'utf8');
    expect(written).toContain('ignore');
  });
});
