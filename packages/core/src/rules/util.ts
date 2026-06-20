/**
 * Shared helpers for rules: finding construction, secret redaction, and a
 * library of ReDoS-safe regexes.
 *
 * Every regex in this file is proven ReDoS-safe in an inline comment. The
 * general technique: anchor where possible, use only bounded quantifiers on
 * disjoint character classes, and never nest unbounded repetition (no `(a+)+`,
 * no `(a|a)*`). Inputs are also size-capped by the engine.
 */
import type { Finding, Rule, RuleContext } from '../types.js';

/** Build a {@link Finding} from a rule + location, defaulting fixable/docs. */
export function makeFinding(
  rule: Pick<Rule, 'id' | 'severity' | 'fixable' | 'docsSlug'>,
  ctx: RuleContext,
  message: string,
  loc?: { line?: number; column?: number },
): Finding {
  return {
    ruleId: rule.id,
    severity: rule.severity,
    message,
    file: ctx.file.path,
    ...(loc?.line !== undefined ? { line: loc.line } : {}),
    ...(loc?.column !== undefined ? { column: loc.column } : {}),
    fixable: rule.fixable,
    docsSlug: rule.docsSlug,
  };
}

/**
 * Redact a secret value for safe display: keep a short recognizable prefix and
 * mask the rest. e.g. `sk-ABCDEF...` → `sk-***`, `ghp_xxxx` → `ghp_***`.
 */
export function redactSecret(value: string): string {
  const v = value.trim();
  // Keep a known token prefix when present, otherwise keep up to 3 chars.
  const prefixMatch = v.match(
    // ReDoS-safe: single alternation of fixed/bounded literals, anchored, no
    // nested quantifiers. Each branch is a bounded char class run.
    /^(sk-proj-|sk-ant-|sk-|ghp_|gho_|ghu_|ghs_|ghr_|github_pat_|xox[baprs]-|AKIA|ASIA|AIza|glpat-)/,
  );
  if (prefixMatch) {
    return `${prefixMatch[1]}***`;
  }
  if (v.length <= 4) return '***';
  return `${v.slice(0, 3)}***`;
}

/** A known Claude Code tool name (for agents). */
export const KNOWN_TOOLS: ReadonlySet<string> = new Set([
  'Read',
  'Write',
  'Edit',
  'MultiEdit',
  'Bash',
  'Grep',
  'Glob',
  'WebFetch',
  'WebSearch',
  'Task',
  'NotebookEdit',
  'TodoWrite',
]);

/** Valid hook event names per SPEC §2.3. */
export const HOOK_EVENTS: ReadonlySet<string> = new Set([
  'PreToolUse',
  'PostToolUse',
  'UserPromptSubmit',
  'Stop',
  'SubagentStop',
  'Notification',
  'SessionStart',
  'SessionEnd',
  'PreCompact',
]);

/** Model aliases valid in agent frontmatter. */
export const AGENT_MODEL_ALIASES: ReadonlySet<string> = new Set([
  'inherit',
  'opus',
  'sonnet',
  'haiku',
]);

/** Model aliases valid in settings/commands. */
export const SETTINGS_MODEL_ALIASES: ReadonlySet<string> = new Set([
  'opus',
  'sonnet',
  'haiku',
  'default',
]);

/**
 * Validate a model id. Accepts the given aliases, or an id matching
 * `^claude-[a-z0-9.-]+$` that does NOT end in `-latest`.
 *
 * ReDoS-safe: `^claude-[a-z0-9.-]+$` is a single bounded character-class
 * repetition anchored at both ends — linear time, no backtracking ambiguity.
 */
export function isValidModel(value: string, aliases: ReadonlySet<string>): boolean {
  if (aliases.has(value)) return true;
  if (!/^claude-[a-z0-9.-]+$/.test(value)) return false;
  if (value.endsWith('-latest')) return false;
  return true;
}

/** True if a string is an `${ENV_VAR}` placeholder (and nothing literal). */
export function isEnvPlaceholder(value: string): boolean {
  // ReDoS-safe: anchored, single bounded class run. Matches `${NAME}` exactly.
  return /^\$\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(value.trim());
}

/** Keys whose values are expected to hold secrets. */
const SECRET_KEY_RE =
  // ReDoS-safe: alternation of fixed substrings inside a non-anchored test;
  // each branch is a literal, no quantifier nesting.
  /(secret|token|api[_-]?key|apikey|password|passwd|pwd|auth|access[_-]?key|private[_-]?key|client[_-]?secret|bearer)/i;

/** True if a config key name suggests it holds a secret. */
export function isSecretKeyName(key: string): boolean {
  return SECRET_KEY_RE.test(key);
}

/**
 * Library of secret-detection patterns. Each pattern is anchored or uses only
 * bounded character classes so it runs in linear time on any input.
 */
export const SECRET_PATTERNS: ReadonlyArray<{ name: string; re: RegExp }> = [
  // OpenAI-style keys. Bounded {16,} on a fixed char class — linear, no nesting.
  { name: 'OpenAI API key', re: /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{16,}\b/ },
  // GitHub tokens: fixed prefixes + bounded class run.
  { name: 'GitHub token', re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/ },
  { name: 'GitHub fine-grained PAT', re: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/ },
  // AWS access key id: fixed prefix + exactly 16 base32-ish chars.
  { name: 'AWS access key id', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  // Google API key.
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  // Slack tokens.
  { name: 'Slack token', re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
  // GitLab personal access token.
  { name: 'GitLab token', re: /\bglpat-[0-9A-Za-z_-]{20,}\b/ },
  // PEM private key header (literal).
  {
    name: 'private key',
    re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/,
  },
];

/**
 * Detect a `Bearer <literal>` token that is NOT an env placeholder.
 *
 * ReDoS-safe: `Bearer ` literal + a single bounded class run `[A-Za-z0-9._-]{8,}`,
 * with a negative lookahead for `${` that is itself a fixed string. No nested
 * quantifiers.
 */
export const BEARER_LITERAL_RE = /\bBearer\s+(?!\$\{)[A-Za-z0-9._-]{8,}\b/;

/**
 * Find all secret matches in a piece of text, returning the matched value and
 * its character offset for location mapping.
 */
export function findSecrets(text: string): Array<{ name: string; value: string; index: number }> {
  const out: Array<{ name: string; value: string; index: number }> = [];
  for (const { name, re } of SECRET_PATTERNS) {
    // Use a global clone to find all occurrences without mutating the source re.
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m: RegExpExecArray | null;
    while ((m = g.exec(text)) !== null) {
      out.push({ name, value: m[0], index: m.index });
      if (m.index === g.lastIndex) g.lastIndex++; // guard zero-width
    }
  }
  const bg = new RegExp(BEARER_LITERAL_RE.source, 'g');
  let bm: RegExpExecArray | null;
  while ((bm = bg.exec(text)) !== null) {
    // Skip example/dummy bearer values.
    if (!isDummySecret(bm[0])) out.push({ name: 'Bearer token', value: bm[0], index: bm.index });
    if (bm.index === bg.lastIndex) bg.lastIndex++;
  }
  return out;
}

/**
 * Whether a value matches a STRUCTURED secret pattern (a known provider prefix
 * plus the required length/charset), e.g. `AKIA…`, `ghp_…`, `sk-…`. Such values
 * are real-format credentials and must NOT be suppressed as "dummy" just
 * because they happen to contain a word like "example" or "fake".
 *
 * ReDoS-safe: reuses the bounded {@link SECRET_PATTERNS} regexes.
 */
function matchesStructuredSecret(value: string): boolean {
  for (const { re } of SECRET_PATTERNS) {
    if (re.test(value)) return true;
  }
  return false;
}

/**
 * Heuristic to avoid false positives on obvious example/placeholder values.
 * These are common in docs and templates and must NOT be flagged.
 *
 * IMPORTANT: a value that matches a structured secret pattern (real provider
 * format) is NEVER suppressed — only clear TEMPLATES are. The broad
 * "example/fake/sample" word list is dropped because it suppressed real
 * secrets like `AKIAEXAMPLEFOOBAR123` or `ghp_fake…REAL…` that merely contain
 * those words.
 */
export function isDummySecret(value: string): boolean {
  // Strip a leading `Bearer ` so structured/template checks see the token.
  const token = value.replace(/^Bearer\s+/i, '');

  // 1) Clear TEMPLATE forms are always dummy, even if they superficially look
  //    structured (e.g. `sk-your-api-key-here`):
  //  - `${…}` env references (`isEnvPlaceholder`)
  //  - `your-…key/token/secret` style placeholders
  //  - explicit placeholder/changeme/redacted markers and `...`
  //  - `<…>` angle-bracket placeholders
  // ReDoS-safe: fixed-substring alternation, single bounded `<[^>]*>`/`\$\{[^}]*\}`,
  // no nested quantifiers.
  if (isEnvPlaceholder(value)) return true;
  if (
    /(your[_-]?(api[_-]?)?(key|token|secret)|placeholder|changeme|redacted|\.\.\.|\$\{[^}]*\}|<[^>]*>)/i.test(
      value,
    )
  ) {
    return true;
  }
  // Repeated single char (e.g. "aaaaaaaa") is not a real secret.
  if (/^(.)\1{6,}$/.test(token)) return true;

  // 2) Otherwise, a value that matches a structured provider format (known
  //    prefix + required length/charset) is a REAL credential and must NOT be
  //    suppressed — even when it contains words like "example"/"fake"/"sample".
  if (matchesStructuredSecret(token) || matchesStructuredSecret(value)) return false;

  // 3) No structured match and no template marker: not a recognized dummy.
  return false;
}

/**
 * Shannon entropy of a string (bits/char). Used to flag high-entropy literals
 * in secret-named fields. Pure arithmetic — no regex, no ReDoS risk.
 */
export function shannonEntropy(s: string): number {
  if (s.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let entropy = 0;
  for (const c of counts.values()) {
    const p = c / s.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

