/**
 * The lint engine: parse files, run applicable rules, apply severity
 * overrides, and aggregate findings into a {@link LintResult}.
 *
 * Pure and synchronous. No filesystem, network, or code execution.
 */
import type {
  Finding,
  FileKind,
  InputFile,
  LintOptions,
  LintResult,
  ParsedFile,
  Rule,
  Severity,
} from './types.js';
import { classifyPath } from './discover.js';
import { normalizeText } from './parse/frontmatter.js';
import { buildParsedFile, makeRuleContext } from './parse/parsed-file.js';
import { allRules } from './rules/index.js';
import { applyFixes } from './fix.js';

/** Hard cap on per-file content size processed by the engine (1 MiB). */
export const MAX_CONTENT_BYTES = 1024 * 1024;

/**
 * Build a {@link ParsedFile} from raw input. Normalizes line endings/BOM and
 * runs the appropriate parser for the file's kind.
 */
export function parseFile(input: InputFile): ParsedFile {
  const kind: FileKind = input.kind ?? classifyPath(input.path);
  const content = normalizeText(input.content);
  return buildParsedFile(input.path, kind, content);
}

/** Make a {@link RuleContext} for a parsed file. */
const makeContext = makeRuleContext;

/**
 * Resolve a rule's effective severity given option overrides. Returns `null`
 * if the rule is turned `off`.
 */
function effectiveSeverity(rule: Rule, opts: LintOptions | undefined): Severity | null {
  const override = opts?.rules?.[rule.id];
  if (override === undefined) return rule.severity;
  if (override === 'off') return null;
  return override;
}

/** Run all applicable rules over a single parsed file. */
function lintParsedFile(file: ParsedFile, opts: LintOptions | undefined): Finding[] {
  const ctx = makeContext(file);
  const findings: Finding[] = [];
  for (const rule of allRules) {
    if (!rule.appliesTo.includes(file.kind)) continue;
    const sev = effectiveSeverity(rule, opts);
    if (sev === null) continue; // disabled
    let ruleFindings: Finding[];
    try {
      ruleFindings = rule.check(ctx);
    } catch {
      // A rule must never crash the engine. Skip on unexpected error.
      ruleFindings = [];
    }
    for (const f of ruleFindings) {
      findings.push({ ...f, severity: sev });
    }
  }
  return findings;
}

/** Sort findings deterministically: by file, then line, then column, then id. */
function sortFindings(findings: Finding[]): Finding[] {
  return findings.sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    if ((a.line ?? 0) !== (b.line ?? 0)) return (a.line ?? 0) - (b.line ?? 0);
    if ((a.column ?? 0) !== (b.column ?? 0)) return (a.column ?? 0) - (b.column ?? 0);
    return a.ruleId.localeCompare(b.ruleId);
  });
}

/** Compute the summary block from a list of findings. */
function summarize(findings: Finding[], filesChecked: number): LintResult['summary'] {
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  for (const f of findings) {
    if (f.severity === 'error') errors++;
    else if (f.severity === 'warning') warnings++;
    else infos++;
  }
  return { errors, warnings, infos, filesChecked };
}

/**
 * Lint a set of in-memory files. Pure: no I/O. When `opts.fix` is set, fixable
 * findings are applied to the content and the file is re-linted on the patched
 * text so the reported findings reflect the post-fix state.
 *
 * @returns the {@link LintResult}. When `fix` is set, also returns the patched
 *   file contents keyed by path via the `fixedFiles` property on the result's
 *   prototype is avoided — instead callers needing patched content should use
 *   {@link lintAndFix}.
 */
export function runEngine(inputs: InputFile[], opts?: LintOptions): LintResult {
  const result = lintAndFix(inputs, opts);
  return result.result;
}

/**
 * Lint and (optionally) fix. Returns both the {@link LintResult} and the map of
 * patched file contents (only changed files appear). The CLI uses the patched
 * contents to write files back to disk.
 */
export function lintAndFix(
  inputs: InputFile[],
  opts?: LintOptions,
): { result: LintResult; fixedFiles: Map<string, string> } {
  const fixedFiles = new Map<string, string>();
  const allFindings: Finding[] = [];
  let filesChecked = 0;

  for (const input of inputs) {
    filesChecked++;
    // Enforce size cap. Oversized files are flagged and skipped.
    const byteLen = Buffer.byteLength(input.content, 'utf8');
    if (byteLen > MAX_CONTENT_BYTES) {
      const kind: FileKind = input.kind ?? classifyPath(input.path);
      allFindings.push({
        ruleId: 'core/file-too-large',
        severity: 'warning',
        message: `File is too large to lint (${byteLen} bytes > ${MAX_CONTENT_BYTES}); skipped.`,
        file: input.path,
        line: 1,
        column: 1,
        fixable: false,
        docsSlug: 'core/file-too-large',
      });
      void kind;
      continue;
    }

    let workingContent = normalizeText(input.content);

    if (opts?.fix) {
      const fixed = applyFixes({ ...input, content: workingContent }, opts);
      if (fixed !== workingContent) {
        fixedFiles.set(input.path, fixed);
        workingContent = fixed;
      }
    }

    const parsed = parseFile({ ...input, content: workingContent });
    const findings = lintParsedFile(parsed, opts);
    allFindings.push(...findings);
  }

  const sorted = sortFindings(allFindings);
  return {
    result: { findings: sorted, summary: summarize(sorted, filesChecked) },
    fixedFiles,
  };
}

