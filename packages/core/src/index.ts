/**
 * `agentlint-core` — public entry point.
 *
 * Exports the two lint functions (SPEC §4), the rule catalog, and all public
 * types. `lintFiles` is PURE (no I/O) and is what the web app calls on pasted
 * text; `lintDirectory` adds filesystem discovery.
 */
import type { InputFile, LintOptions, LintResult } from './types.js';
import { discoverFiles } from './discover.js';
import { runEngine, lintAndFix } from './engine.js';
import { allRules } from './rules/index.js';

/**
 * Lint a set of in-memory files. Pure — performs no filesystem, network, or
 * code-execution side effects. Used by the web validator on pasted content.
 *
 * @param files Files to lint (`path`, `content`, optional `kind`).
 * @param opts  Lint options (severity overrides, fix, ignore, cwd).
 */
export function lintFiles(files: InputFile[], opts?: LintOptions): LintResult {
  return runEngine(files, opts);
}

/**
 * Lint a directory: discover relevant files, then lint them. The only function
 * in this package that touches the filesystem.
 *
 * @param dir  Directory to scan.
 * @param opts Lint options. `opts.ignore` is applied during discovery.
 */
export async function lintDirectory(dir: string, opts?: LintOptions): Promise<LintResult> {
  const files = await discoverFiles(dir, opts?.ignore ?? []);
  return runEngine(files, opts);
}

/**
 * Lint a directory and additionally return patched file contents for any files
 * changed by `opts.fix`. Intended for the CLI, which writes the patches back.
 */
export async function lintDirectoryWithFixes(
  dir: string,
  opts?: LintOptions,
): Promise<{ result: LintResult; fixedFiles: Map<string, string> }> {
  const files = await discoverFiles(dir, opts?.ignore ?? []);
  return lintAndFix(files, opts);
}

/** Lint in-memory files and return patched contents (pure). */
export function lintFilesWithFixes(
  files: InputFile[],
  opts?: LintOptions,
): { result: LintResult; fixedFiles: Map<string, string> } {
  return lintAndFix(files, opts);
}

/** The rule catalog (for docs / the web rules page). */
export const rules = allRules;

export { discoverFiles, classifyPath, MAX_FILE_BYTES, compileIgnore } from './discover.js';
export { applyFixes } from './fix.js';
export { parseFrontmatter, normalizeText } from './parse/frontmatter.js';
export { parseJson } from './parse/json.js';
export { slugifyName } from './rules/agent.js';

export type {
  Finding,
  LintResult,
  LintOptions,
  Rule,
  RuleContext,
  RuleMeta,
  FileKind,
  Severity,
  ParsedFile,
  ParsedFrontmatter,
  ParsedJson,
  ParseError,
  InputFile,
  FixResult,
} from './types.js';
