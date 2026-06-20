import { lintFiles } from '../src/index.js';
import type { FileKind, Finding, LintOptions } from '../src/types.js';

/** Lint a single in-memory file and return its findings. */
export function lintOne(path: string, content: string, kind?: FileKind, opts?: LintOptions): Finding[] {
  return lintFiles([kind ? { path, content, kind } : { path, content }], opts).findings;
}

/** True if any finding has the given rule id. */
export function has(findings: Finding[], ruleId: string): boolean {
  return findings.some((f) => f.ruleId === ruleId);
}

/** Get all findings with a given rule id. */
export function ofRule(findings: Finding[], ruleId: string): Finding[] {
  return findings.filter((f) => f.ruleId === ruleId);
}
