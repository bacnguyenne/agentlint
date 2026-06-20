#!/usr/bin/env node
/**
 * `agentlint` — the CLI entry point (SPEC §5).
 *
 * Responsibilities:
 *  - Parse argv (see {@link parseArgs}).
 *  - Load `.agentlintrc.json` from cwd upward and merge into core options.
 *  - Run `lintDirectory` over each path and merge findings.
 *  - With `--fix`, apply safe fixes via core and write patched files back.
 *  - Report via the stylish or json reporter.
 *  - Map outcomes to exit codes and NEVER throw an unhandled exception.
 *
 * Exit codes:
 *   0 — no errors (and warnings within --max-warnings)
 *   1 — errors found, OR warnings exceeded --max-warnings
 *   2 — usage error / IO error / bad config
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Finding, LintOptions, LintResult } from 'agentlint-core';
import { lintDirectory, lintDirectoryWithFixes } from 'agentlint-core';
import { parseArgs, type LintCommand } from './args.js';
import { runAdd } from './add.js';
import { startMcpServer } from './mcp.js';
import {
  CONFIG_FILENAME,
  ConfigError,
  STARTER_CONFIG,
  loadConfig,
  toLintOptions,
} from './config.js';
import { formatJson, formatStylish, makeColors } from './format.js';

/** A minimal IO surface so the runnable core is testable in isolation. */
export interface Io {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
  cwd: () => string;
  env: NodeJS.ProcessEnv;
  /** Whether stdout is a TTY (drives `auto` color resolution). */
  isTTY: boolean;
}

const defaultIo: Io = {
  stdout: (s) => process.stdout.write(s),
  stderr: (s) => process.stderr.write(s),
  cwd: () => process.cwd(),
  env: process.env,
  isTTY: Boolean(process.stdout.isTTY),
};

/**
 * Run the CLI and return the process exit code. This function never throws:
 * all errors are caught and mapped to exit code 2 with a stderr message.
 *
 * @param argv Arguments (already sliced past `node` + script path).
 * @param io   IO surface (defaults to the real process streams).
 */
export async function run(argv: string[], io: Io = defaultIo): Promise<number> {
  try {
    return await runInner(argv, io);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    io.stderr(`agentlint: ${msg}\n`);
    return 2;
  }
}

async function runInner(argv: string[], io: Io): Promise<number> {
  const parsed = parseArgs(argv, io.env);

  switch (parsed.kind) {
    case 'error':
      io.stderr(`agentlint: ${parsed.message}\n`);
      io.stderr(`Run 'agentlint --help' for usage.\n`);
      return 2;
    case 'help':
      io.stdout(helpText());
      return 0;
    case 'version':
      io.stdout(`${await readVersion()}\n`);
      return 0;
    case 'mcp':
      // Run the MCP stdio server. It reads stdin until closed, so this never
      // resolves — returning a pending promise keeps the process alive.
      startMcpServer();
      return new Promise<number>(() => {});
    case 'init':
      return runInit(parsed.force, io);
    case 'add':
      return runAdd(parsed, io);
    case 'lint':
      return runLint(parsed, io);
  }
}

/** Implements `agentlint init`. */
async function runInit(force: boolean, io: Io): Promise<number> {
  const target = path.join(io.cwd(), CONFIG_FILENAME);
  if (!force) {
    try {
      await fs.access(target);
      io.stderr(
        `agentlint: ${CONFIG_FILENAME} already exists. Use --force to overwrite.\n`,
      );
      return 2;
    } catch {
      // Does not exist: proceed.
    }
  }
  try {
    await fs.writeFile(target, STARTER_CONFIG, 'utf8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    io.stderr(`agentlint: failed to write ${CONFIG_FILENAME}: ${msg}\n`);
    return 2;
  }
  io.stdout(`Created ${CONFIG_FILENAME}\n`);
  return 0;
}

/** Implements the default lint command. */
async function runLint(cmd: LintCommand, io: Io): Promise<number> {
  // Load nearest config (cwd upward). Bad config → exit 2.
  let lintOptions: LintOptions;
  try {
    const loaded = await loadConfig(io.cwd());
    lintOptions = toLintOptions(loaded.config);
  } catch (err) {
    if (err instanceof ConfigError) {
      io.stderr(`agentlint: ${err.message}\n`);
      return 2;
    }
    throw err;
  }

  // Validate every path exists and is a directory BEFORE linting, so a bad
  // path is a clean usage error (exit 2) rather than silent empty output.
  for (const p of cmd.paths) {
    const abs = path.resolve(io.cwd(), p);
    let stat: import('node:fs').Stats;
    try {
      stat = await fs.stat(abs);
    } catch {
      io.stderr(`agentlint: no such file or directory: ${p}\n`);
      return 2;
    }
    if (!stat.isDirectory()) {
      io.stderr(`agentlint: not a directory: ${p}\n`);
      return 2;
    }
  }

  // Lint each path, merging findings. `filesChecked` sums across paths.
  const allFindings: Finding[] = [];
  let filesChecked = 0;
  let fixedCount = 0;

  // Dedupe overlapping/duplicate roots (e.g. `agentlint . .`) so the same files
  // aren't linted — and counted — twice.
  const seenRoots = new Set<string>();
  const uniquePaths = cmd.paths.filter((p) => {
    const abs = path.resolve(io.cwd(), p);
    if (seenRoots.has(abs)) return false;
    seenRoots.add(abs);
    return true;
  });

  for (const p of uniquePaths) {
    const abs = path.resolve(io.cwd(), p);
    const opts: LintOptions = { ...lintOptions, cwd: abs };

    if (cmd.fix) {
      const { result, fixedFiles } = await lintDirectoryWithFixes(abs, {
        ...opts,
        fix: true,
      });
      for (const [relPath, content] of fixedFiles) {
        const fileAbs = path.resolve(abs, relPath);
        try {
          // Atomic write: write a sibling temp file, then rename over the target
          // (atomic on POSIX). An interrupt mid-write can't corrupt the user's
          // CLAUDE.md / settings.json — the original stays intact until rename.
          const tmp = `${fileAbs}.agentlint-${process.pid}.tmp`;
          await fs.writeFile(tmp, content, 'utf8');
          await fs.rename(tmp, fileAbs);
          fixedCount++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          io.stderr(`agentlint: failed to write fix to ${relPath}: ${msg}\n`);
          return 2;
        }
      }
      mergeResult(allFindings, result, p);
      filesChecked += result.summary.filesChecked;
    } else {
      const result = await lintDirectory(abs, opts);
      mergeResult(allFindings, result, p);
      filesChecked += result.summary.filesChecked;
    }
  }

  // Build the merged, sorted, possibly-quiet-filtered result.
  const merged = buildMergedResult(allFindings, filesChecked, cmd.quiet);

  // Report.
  const fixedArg = cmd.fix ? { fixedCount } : {};
  if (cmd.format === 'json') {
    io.stdout(`${formatJson(merged, fixedArg)}\n`);
  } else {
    const colorEnabled =
      cmd.colorMode === 'always' || (cmd.colorMode === 'auto' && io.isTTY);
    const colors = makeColors(colorEnabled);
    io.stdout(`${formatStylish(merged, colors, fixedArg)}\n`);
  }

  return exitCode(merged, cmd.maxWarnings);
}

/**
 * Merge a per-path {@link LintResult} into the accumulator, prefixing finding
 * file paths with the user-supplied path so output is unambiguous across
 * multiple roots. A single path of `.` is left unprefixed for clean output.
 */
function mergeResult(acc: Finding[], result: LintResult, userPath: string): void {
  const prefix = userPath === '.' ? '' : userPath.replace(/\/+$/, '') + '/';
  for (const f of result.findings) {
    acc.push(prefix ? { ...f, file: prefix + f.file } : f);
  }
}

/**
 * Build the final result from merged findings: re-sort deterministically,
 * optionally drop non-errors for `--quiet`, and recompute the summary so it
 * reflects the rendered findings.
 */
function buildMergedResult(
  findings: Finding[],
  filesChecked: number,
  quiet: boolean,
): LintResult {
  const visible = quiet ? findings.filter((f) => f.severity === 'error') : findings;
  const sorted = [...visible].sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    if ((a.line ?? 0) !== (b.line ?? 0)) return (a.line ?? 0) - (b.line ?? 0);
    if ((a.column ?? 0) !== (b.column ?? 0)) return (a.column ?? 0) - (b.column ?? 0);
    return a.ruleId.localeCompare(b.ruleId);
  });

  // Drop exact-duplicate findings (e.g. surfaced by overlapping roots) so the
  // same problem isn't reported — or counted — twice.
  const seen = new Set<string>();
  const deduped = sorted.filter((f) => {
    const key = `${f.file} ${f.line ?? ''} ${f.column ?? ''} ${f.ruleId} ${f.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let errors = 0;
  let warnings = 0;
  let infos = 0;
  for (const f of deduped) {
    if (f.severity === 'error') errors++;
    else if (f.severity === 'warning') warnings++;
    else infos++;
  }

  return {
    findings: deduped,
    summary: { errors, warnings, infos, filesChecked },
  };
}

/**
 * Determine the process exit code from the merged result and the
 * `--max-warnings` threshold.
 */
function exitCode(result: LintResult, maxWarnings: number | null): number {
  if (result.summary.errors > 0) return 1;
  if (maxWarnings !== null && result.summary.warnings > maxWarnings) return 1;
  return 0;
}

/** Read the CLI version from the package manifest (best-effort). */
async function readVersion(): Promise<string> {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    // dist/index.js → package root is one level up from dist.
    const pkgPath = path.join(here, '..', 'package.json');
    const raw = await fs.readFile(pkgPath, 'utf8');
    const pkg = JSON.parse(raw) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** The `--help` text. */
function helpText(): string {
  return `agentlint — lint & security-check your AI coding-agent configuration

Usage:
  agentlint [options] [paths...]
  agentlint init [--force]
  agentlint add <id> [--force] [--dry-run]
  agentlint add --list
  agentlint mcp

Arguments:
  paths                One or more directories to lint (default: ".").

Options:
  --fix                Apply safe autofixes and write files back.
  --format <fmt>       Output format: "stylish" (default) or "json".
  --quiet              Report errors only (suppress warnings and infos).
  --max-warnings <n>   Exit 1 if warnings exceed n (n >= 0).
  --no-color           Disable colored output (also honors NO_COLOR).
  --color              Force colored output even when stdout is not a TTY.
  -v, --version        Print the version and exit.
  -h, --help           Show this help and exit.

Commands:
  init                 Write a starter .agentlintrc.json (refuses to overwrite
                       without --force).
  add <id>             Install a catalog item (skill / MCP server / tool) into
                       the current project. MCP servers merge into .mcp.json;
                       files are not overwritten without --force. Use
                       "agentlint add --list" to see all ids, "--dry-run" to
                       preview.
  mcp                  Run the agentlint MCP server (stdio) so an agent can lint
                       its own config. Same as the "agentlint-mcp" binary.

Configuration:
  .agentlintrc.json    Loaded from the current directory upward. Supports
                       { "rules": { "<id>": "off|error|warning|info" },
                         "ignore": ["glob", ...] }.

Exit codes:
  0  No errors (warnings within --max-warnings).
  1  Errors found, or warnings exceeded --max-warnings.
  2  Usage error, IO error, or invalid configuration.
`;
}

// Execute when invoked directly (not when imported by tests).
const invokedDirectly =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
  run(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (err: unknown) => {
      // Defensive: run() should never reject, but never let it crash silently.
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`agentlint: fatal: ${msg}\n`);
      process.exitCode = 2;
    },
  );
}
