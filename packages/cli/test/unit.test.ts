/**
 * Unit tests for the CLI's pure modules: argv parsing, config parsing, and the
 * reporters. These import the built `dist` so they exercise the same code the
 * binary runs.
 */
import { describe, expect, it } from 'vitest';
import type { LintResult } from 'agentlint-core';
import { parseArgs } from '../dist/args.js';
import { parseConfig, toLintOptions } from '../dist/config.js';
import { formatJson, formatStylish, makeColors } from '../dist/format.js';

describe('parseArgs', () => {
  it('defaults to linting "." with stylish format', () => {
    const r = parseArgs([], {});
    expect(r).toMatchObject({ kind: 'lint', paths: ['.'], format: 'stylish' });
  });

  it('collects multiple paths', () => {
    const r = parseArgs(['a', 'b'], {});
    expect(r).toMatchObject({ kind: 'lint', paths: ['a', 'b'] });
  });

  it('parses flags', () => {
    const r = parseArgs(['--fix', '--quiet', '--format', 'json', '--max-warnings', '3'], {});
    expect(r).toMatchObject({
      kind: 'lint',
      fix: true,
      quiet: true,
      format: 'json',
      maxWarnings: 3,
    });
  });

  it('supports --flag=value syntax', () => {
    const r = parseArgs(['--format=json', '--max-warnings=0'], {});
    expect(r).toMatchObject({ kind: 'lint', format: 'json', maxWarnings: 0 });
  });

  it('treats --help and --version as meta commands regardless of position', () => {
    expect(parseArgs(['foo', '--help'], {})).toEqual({ kind: 'help' });
    expect(parseArgs(['--version', 'bar'], {})).toEqual({ kind: 'version' });
  });

  it('errors on unknown flags', () => {
    expect(parseArgs(['--nope'], {})).toMatchObject({ kind: 'error' });
  });

  it('errors on invalid --format', () => {
    expect(parseArgs(['--format', 'yaml'], {})).toMatchObject({ kind: 'error' });
  });

  it('errors on negative / non-integer --max-warnings', () => {
    expect(parseArgs(['--max-warnings', '-1'], {})).toMatchObject({ kind: 'error' });
    expect(parseArgs(['--max-warnings', 'x'], {})).toMatchObject({ kind: 'error' });
  });

  // Regression (fix 11): `--max-warnings -1` must consume the "-1" token and
  // report a clear invalid/non-negative number error — NOT "requires a value".
  it('reports an invalid-number error (not "requires a value") for --max-warnings -1', () => {
    const r = parseArgs(['--max-warnings', '-1'], {});
    expect(r).toMatchObject({ kind: 'error' });
    const msg = (r as { message: string }).message;
    expect(msg).toMatch(/non-negative/i);
    expect(msg).toMatch(/-1/);
    expect(msg).not.toMatch(/requires a value/i);
  });

  // --format must still reject a following flag as a missing value.
  it('still treats a following flag as a missing value for --format', () => {
    const r = parseArgs(['--format', '--fix'], {});
    expect(r).toMatchObject({ kind: 'error' });
    expect((r as { message: string }).message).toMatch(/requires a value/i);
  });

  it('errors when a value flag has no value', () => {
    expect(parseArgs(['--format'], {})).toMatchObject({ kind: 'error' });
  });

  it('resolves color mode from --no-color, --color, and NO_COLOR env', () => {
    expect(parseArgs(['--no-color'], {})).toMatchObject({ colorMode: 'never' });
    expect(parseArgs([], { NO_COLOR: '1' })).toMatchObject({ colorMode: 'never' });
    expect(parseArgs([], {})).toMatchObject({ colorMode: 'auto' });
    expect(parseArgs(['--color'], {})).toMatchObject({ colorMode: 'always' });
    // Explicit --color overrides NO_COLOR.
    expect(parseArgs(['--color'], { NO_COLOR: '1' })).toMatchObject({ colorMode: 'always' });
  });

  it('parses the init subcommand and --force', () => {
    expect(parseArgs(['init'], {})).toEqual({ kind: 'init', force: false });
    expect(parseArgs(['init', '--force'], {})).toEqual({ kind: 'init', force: true });
    expect(parseArgs(['init', '--bad'], {})).toMatchObject({ kind: 'error' });
  });
});

describe('parseConfig', () => {
  it('parses rules and ignore', () => {
    const cfg = parseConfig(
      JSON.stringify({ rules: { 'agent/invalid-name': 'off' }, ignore: ['dist'] }),
      'cfg.json',
    );
    expect(cfg).toEqual({ rules: { 'agent/invalid-name': 'off' }, ignore: ['dist'] });
    expect(toLintOptions(cfg)).toEqual({
      rules: { 'agent/invalid-name': 'off' },
      ignore: ['dist'],
    });
  });

  it('rejects non-object root', () => {
    expect(() => parseConfig('[]', 'cfg.json')).toThrow();
    expect(() => parseConfig('"x"', 'cfg.json')).toThrow();
  });

  it('rejects invalid JSON', () => {
    expect(() => parseConfig('{', 'cfg.json')).toThrow(/Invalid JSON/);
  });

  it('rejects invalid severity values', () => {
    expect(() => parseConfig(JSON.stringify({ rules: { x: 'loud' } }), 'cfg.json')).toThrow();
  });

  it('rejects a non-array ignore', () => {
    expect(() => parseConfig(JSON.stringify({ ignore: 'dist' }), 'cfg.json')).toThrow();
  });
});

describe('reporters', () => {
  const result: LintResult = {
    findings: [
      {
        ruleId: 'agent/invalid-name',
        severity: 'error',
        message: 'bad name',
        file: 'a.md',
        line: 2,
        column: 1,
        fixable: true,
        docsSlug: 'agent/invalid-name',
      },
      {
        ruleId: 'agent/unknown-tool',
        severity: 'warning',
        message: 'unknown tool',
        file: 'a.md',
        line: 3,
        column: 1,
        fixable: false,
        docsSlug: 'agent/unknown-tool',
      },
    ],
    summary: { errors: 1, warnings: 1, infos: 0, filesChecked: 1 },
  };

  const empty: LintResult = {
    findings: [],
    summary: { errors: 0, warnings: 0, infos: 0, filesChecked: 1 },
  };

  it('stylish groups by file and shows a summary footer', () => {
    const out = formatStylish(result, makeColors(false));
    expect(out).toContain('a.md');
    expect(out).toContain('agent/invalid-name');
    expect(out).toContain('(fixable)');
    expect(out).toMatch(/✖ 1 error, 1 warning \(1 fixable\)/);
  });

  it('stylish reports success on empty', () => {
    const out = formatStylish(empty, makeColors(false));
    expect(out).toContain('No problems found');
  });

  // Regression (fix 10): the summary phrase must omit zero-count categories
  // (never "0 warnings" / "0 errors"); all-zero prints "0 problems".
  it('omits zero-count categories from the summary phrase', () => {
    const warningsOnly: LintResult = {
      findings: [
        {
          ruleId: 'agent/unknown-tool',
          severity: 'warning',
          message: 'unknown tool',
          file: 'a.md',
          line: 1,
          column: 1,
          fixable: false,
          docsSlug: 'agent/unknown-tool',
        },
      ],
      summary: { errors: 0, warnings: 1, infos: 0, filesChecked: 1 },
    };
    const out = formatStylish(warningsOnly, makeColors(false));
    expect(out).toMatch(/✖ 1 warning/);
    expect(out).not.toMatch(/0 errors?/);
    expect(out).not.toMatch(/0 warnings?/);

    const errorsOnly: LintResult = {
      findings: [
        {
          ruleId: 'agent/invalid-name',
          severity: 'error',
          message: 'bad name',
          file: 'a.md',
          line: 1,
          column: 1,
          fixable: false,
          docsSlug: 'agent/invalid-name',
        },
      ],
      summary: { errors: 1, warnings: 0, infos: 0, filesChecked: 1 },
    };
    const errOut = formatStylish(errorsOnly, makeColors(false));
    expect(errOut).toMatch(/✖ 1 error/);
    expect(errOut).not.toMatch(/0 warnings?/);
  });

  it('prints "0 problems" when there are no findings', () => {
    const out = formatStylish(empty, makeColors(false));
    expect(out).toMatch(/0 problems/);
  });

  it('stylish includes a fixed count when provided', () => {
    const out = formatStylish(empty, makeColors(false), { fixedCount: 3 });
    expect(out).toContain('3 problems fixed');
  });

  it('makeColors(true) actually colorizes', () => {
    const out = formatStylish(result, makeColors(true));
    // ANSI escape present somewhere.
    // eslint-disable-next-line no-control-regex
    expect(out).toMatch(/\[/);
  });

  it('json is stable and parseable', () => {
    const out = formatJson(result);
    const parsed = JSON.parse(out) as LintResult;
    expect(parsed.summary.errors).toBe(1);
    expect(parsed.findings).toHaveLength(2);
    expect(parsed.findings[0]!.ruleId).toBe('agent/invalid-name');
  });

  it('json includes the fixed count when provided', () => {
    const out = formatJson(result, { fixedCount: 2 });
    const parsed = JSON.parse(out) as { fixed: number };
    expect(parsed.fixed).toBe(2);
  });
});
