/**
 * Reporters for the agentlint CLI (SPEC §5).
 *
 * - `stylish`: human-readable, grouped by file, colorized, with a summary
 *   footer like "✖ 3 errors, 2 warnings (1 fixable)".
 * - `json`: stable, machine-readable JSON of the {@link LintResult}.
 *
 * Color is controlled by the caller (it honors `--no-color` and `NO_COLOR`),
 * which constructs the picocolors instance and passes it in.
 */
import type { Finding, LintResult } from 'agentlint-core';
import pc from 'picocolors';

/** A picocolors-compatible color API (subset we use). */
export interface Colors {
  red: (s: string) => string;
  yellow: (s: string) => string;
  blue: (s: string) => string;
  dim: (s: string) => string;
  bold: (s: string) => string;
  underline: (s: string) => string;
  green: (s: string) => string;
}

/** Identity colorizer used when color is disabled. */
const NO_COLORS: Colors = {
  red: (s) => s,
  yellow: (s) => s,
  blue: (s) => s,
  dim: (s) => s,
  bold: (s) => s,
  underline: (s) => s,
  green: (s) => s,
};

/**
 * Build a {@link Colors} instance. When `enabled` is false, returns the
 * identity colorizer so output is plain text. When enabled, color is FORCED via
 * `picocolors.createColors(true)` rather than relying on TTY auto-detection —
 * the CLI has already decided color is wanted (respecting `--no-color` /
 * `NO_COLOR`), so it should apply even when stdout is piped.
 */
export function makeColors(enabled: boolean): Colors {
  if (!enabled) return NO_COLORS;
  const c = pc.createColors(true);
  return {
    red: c.red,
    yellow: c.yellow,
    blue: c.blue,
    dim: c.dim,
    bold: c.bold,
    underline: c.underline,
    green: c.green,
  };
}

/** Pad a string on the right to `width` columns. */
function padEnd(s: string, width: number): string {
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

/** Pad a string on the left to `width` columns. */
function padStart(s: string, width: number): string {
  return s.length >= width ? s : ' '.repeat(width - s.length) + s;
}

/** Colorize a severity label. */
function colorSeverity(c: Colors, severity: Finding['severity']): string {
  if (severity === 'error') return c.red('error');
  if (severity === 'warning') return c.yellow('warning');
  return c.blue('info');
}

/**
 * Render the `stylish` report. Findings are grouped by file (preserving the
 * engine's deterministic ordering), with aligned columns:
 *
 *   <file> (underlined)
 *     line:col  severity  message  ruleId
 *
 * `quiet` (errors-only) filtering is applied by the caller before this; the
 * summary footer always reflects the (already filtered) findings passed in.
 */
export function formatStylish(
  result: LintResult,
  colors: Colors,
  options: { fixedCount?: number } = {},
): string {
  const c = colors;
  const findings = result.findings;

  if (findings.length === 0) {
    const head = c.green('✔') + ' No problems found';
    const footer = summaryFooter(result, c, options.fixedCount);
    return `${head}\n${footer}`;
  }

  // Group by file in first-seen order.
  const groups = new Map<string, Finding[]>();
  for (const f of findings) {
    const list = groups.get(f.file);
    if (list) list.push(f);
    else groups.set(f.file, [f]);
  }

  const blocks: string[] = [];
  for (const [file, fs] of groups) {
    // Compute column widths within the group for clean alignment.
    let posWidth = 0;
    let sevWidth = 0;
    let msgWidth = 0;
    const rows = fs.map((f) => {
      // Render `line:col`, or just `line` when no column, or `-` when neither —
      // never a misleading `:0` (column/line are 1-based, so 0 is not valid).
      const pos =
        f.line === undefined ? '-' : f.column === undefined ? `${f.line}` : `${f.line}:${f.column}`;
      const sev = f.severity;
      const msg = f.message;
      posWidth = Math.max(posWidth, pos.length);
      sevWidth = Math.max(sevWidth, sev.length);
      msgWidth = Math.max(msgWidth, msg.length);
      return { pos, sev, msg, ruleId: f.ruleId, fixable: f.fixable };
    });

    const lines = rows.map((r) => {
      const pos = c.dim(padStart(r.pos, posWidth));
      const sev = colorSeverity(c, r.sev as Finding['severity']) +
        ' '.repeat(Math.max(0, sevWidth - r.sev.length));
      const msg = padEnd(r.msg, msgWidth);
      const rule = c.dim(r.ruleId) + (r.fixable ? c.dim(' (fixable)') : '');
      return `  ${pos}  ${sev}  ${msg}  ${rule}`;
    });

    blocks.push(`${c.underline(file)}\n${lines.join('\n')}`);
  }

  const footer = summaryFooter(result, c, options.fixedCount);
  return `${blocks.join('\n\n')}\n\n${footer}`;
}

/**
 * Build the one-line summary footer, e.g.
 *   ✖ 3 errors, 2 warnings, 1 info (2 fixable)
 * Counts come from the rendered findings, not the engine summary, so quiet
 * mode produces a consistent footer.
 */
function summaryFooter(result: LintResult, c: Colors, fixedCount?: number): string {
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  let fixable = 0;
  for (const f of result.findings) {
    if (f.severity === 'error') errors++;
    else if (f.severity === 'warning') warnings++;
    else infos++;
    if (f.fixable) fixable++;
  }

  if (fixedCount !== undefined) {
    const fixedMsg = `${fixedCount} ${plural(fixedCount, 'problem')} fixed`;
    if (errors + warnings + infos === 0) {
      return c.green(`✔ ${fixedMsg}; no remaining problems`);
    }
    const remaining = problemPhrase(errors, warnings, infos);
    return c.bold(symbol(errors) + ` ${fixedMsg}; ${remaining} remaining`);
  }

  if (errors + warnings + infos === 0) {
    return c.green('✔ 0 problems');
  }

  const phrase = problemPhrase(errors, warnings, infos);
  const fixablePart = fixable > 0 ? c.dim(` (${fixable} fixable)`) : '';
  const colored =
    errors > 0 ? c.red(`✖ ${phrase}`) : c.yellow(`✖ ${phrase}`);
  return c.bold(colored) + fixablePart;
}

/**
 * Build "N errors, M warnings, K infos", omitting any zero-count category (so we
 * never print "0 warnings"). When every category is zero, return "0 problems".
 */
function problemPhrase(errors: number, warnings: number, infos: number): string {
  const parts: string[] = [];
  if (errors > 0) parts.push(`${errors} ${plural(errors, 'error')}`);
  if (warnings > 0) parts.push(`${warnings} ${plural(warnings, 'warning')}`);
  if (infos > 0) parts.push(`${infos} ${plural(infos, 'info')}`);
  if (parts.length === 0) return '0 problems';
  return parts.join(', ');
}

/** Choose the leading status symbol based on whether errors exist. */
function symbol(errors: number): string {
  return errors > 0 ? '✖' : '✔';
}

/** Naive English pluralizer for our fixed vocabulary. */
function plural(n: number, word: string): string {
  if (n === 1) return word;
  if (word === 'info') return 'infos';
  return word + 's';
}

/**
 * Render the `json` report: a stable serialization of the {@link LintResult}.
 * Keys are emitted in a fixed order so output diffs are clean across runs.
 */
export function formatJson(
  result: LintResult,
  options: { fixedCount?: number } = {},
): string {
  const findings = result.findings.map((f) => orderFinding(f));
  const payload: Record<string, unknown> = {
    findings,
    summary: {
      errors: result.summary.errors,
      warnings: result.summary.warnings,
      infos: result.summary.infos,
      filesChecked: result.summary.filesChecked,
    },
  };
  if (options.fixedCount !== undefined) payload.fixed = options.fixedCount;
  return JSON.stringify(payload, null, 2);
}

/** Emit a finding's fields in a stable key order. */
function orderFinding(f: Finding): Record<string, unknown> {
  const out: Record<string, unknown> = {
    ruleId: f.ruleId,
    severity: f.severity,
    message: f.message,
    file: f.file,
  };
  if (f.line !== undefined) out.line = f.line;
  if (f.column !== undefined) out.column = f.column;
  out.fixable = f.fixable;
  out.docsSlug = f.docsSlug;
  return out;
}
