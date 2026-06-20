/**
 * Apply safe autofixes to a single file's content.
 *
 * Design for determinism & idempotency:
 *  - Fixes operate on whole-file content (each fixable rule returns the new
 *    full content), so applying multiple fixes is just a fold.
 *  - We re-parse the file after each applied fix and re-run rules, because one
 *    fix can change the parse (e.g. JSON reserialization changes line numbers).
 *  - A bounded number of passes guarantees termination; idempotency follows
 *    because once no rule reports a fixable finding, the content is stable.
 */
import type { FileKind, InputFile, LintOptions, Rule, Severity } from './types.js';
import { classifyPath } from './discover.js';
import { normalizeText } from './parse/frontmatter.js';
import { buildParsedFile, makeRuleContext } from './parse/parsed-file.js';
import { allRules } from './rules/index.js';

/** Max fix passes to prevent any pathological oscillation. */
const MAX_PASSES = 10;

function isEnabled(rule: Rule, opts: LintOptions | undefined): boolean {
  const override = opts?.rules?.[rule.id] as 'off' | Severity | undefined;
  return override !== 'off';
}

/**
 * Apply all enabled fixable rules to `input.content`, returning the new
 * content. Pure. Idempotent: running on already-fixed content returns it
 * unchanged.
 */
export function applyFixes(input: InputFile, opts?: LintOptions): string {
  const kind: FileKind = input.kind ?? classifyPath(input.path);
  let content = normalizeText(input.content);

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let changedThisPass = false;

    for (const rule of allRules) {
      if (!rule.appliesTo.includes(kind)) continue;
      if (!rule.fixable || typeof rule.fix !== 'function') continue;
      if (!isEnabled(rule, opts)) continue;

      // Build a fresh context from the current content so locations and parsed
      // data reflect any edits applied earlier in this pass.
      const ctx = makeRuleContext(buildParsedFile(input.path, kind, content));

      let findings;
      try {
        findings = rule.check(ctx);
      } catch {
        continue; // never let a rule crash the fixer
      }
      for (const finding of findings) {
        if (!finding.fixable) continue;
        let next;
        try {
          next = rule.fix(ctx, finding);
        } catch {
          continue;
        }
        if (next && next.content !== content) {
          content = next.content;
          changedThisPass = true;
          break; // re-evaluate this rule's findings against fresh content
        }
      }
    }

    if (!changedThisPass) break;
  }

  return content;
}
