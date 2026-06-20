/**
 * Core public types for `agentlint-core`.
 *
 * These mirror SPEC §4 exactly. Anything exported here is part of the public
 * API consumed by the CLI and the web app, so it must stay stable.
 */

/** Severity of a finding. `error` causes a non-zero CLI exit. */
export type Severity = 'error' | 'warning' | 'info';

/**
 * What a discovered/parsed file represents. Drives which rules apply.
 * - `agent`    → `.claude/agents/*.md`
 * - `command`  → `.claude/commands/**\/*.md`
 * - `skill`    → `.claude/skills/<name>/SKILL.md` (Claude Code Agent Skills)
 * - `settings` → `.claude/settings.json` / `settings.local.json`
 * - `mcp`      → `.mcp.json`
 * - `claudemd` → `CLAUDE.md` (and nested)
 * - `instructions` → cross-tool agent instruction files: `AGENTS.md`,
 *   `.cursorrules`, `.cursor/rules/*.mdc`, `.github/copilot-instructions.md`,
 *   `.windsurfrules`, `.clinerules`. Treated as raw markdown (no frontmatter/JSON
 *   parse); the cross-cutting security rules scan them for secrets & RCE.
 * - `unknown`  → discovered but unclassifiable (rare; rules skip it)
 */
export type FileKind = 'agent' | 'command' | 'skill' | 'settings' | 'mcp' | 'claudemd' | 'instructions' | 'unknown';

/** A single problem reported by a rule. */
export interface Finding {
  /** Stable rule id, e.g. `security/hardcoded-secret`. */
  ruleId: string;
  /** Effective severity after option overrides. */
  severity: Severity;
  /** Human-readable message. Secret values MUST be redacted here. */
  message: string;
  /** Absolute or repo-relative path of the offending file. */
  file: string;
  /** 1-based line number, when locatable. */
  line?: number;
  /** 1-based column number, when locatable. */
  column?: number;
  /** Whether this finding has a safe autofix available. */
  fixable: boolean;
  /** Docs slug for the "why / how to fix" explanation. */
  docsSlug: string;
}

/** Aggregate result of a lint run. */
export interface LintResult {
  findings: Finding[];
  summary: {
    errors: number;
    warnings: number;
    infos: number;
    filesChecked: number;
  };
}

/** Options controlling a lint run. */
export interface LintOptions {
  /** Apply safe fixes to file contents (used by CLI `--fix` / web preview). */
  fix?: boolean;
  /**
   * Per-rule severity override. `'off'` disables the rule; the others force a
   * severity regardless of the rule's default.
   */
  rules?: Record<string, 'off' | Severity>;
  /** Glob-ish ignore patterns (gitignore-style) applied during discovery. */
  ignore?: string[];
  /** Working directory; paths in findings are reported relative to this. */
  cwd?: string;
}

/**
 * A file presented to the engine. `lintFiles` accepts these directly (no I/O);
 * `lintDirectory` builds them from disk.
 */
export interface InputFile {
  path: string;
  content: string;
  /** If omitted, the engine classifies by path. */
  kind?: FileKind;
}

/**
 * Result of applying a fix: the new full file content. Fixes operate on the
 * whole content string so the engine can re-run rules on the patched text.
 */
export interface FixResult {
  /** New full content for the file. */
  content: string;
}

/**
 * Parsed representation of a file, shared by all rules that target the same
 * kind. Parsing happens once per file in the engine; rules read this.
 */
export interface ParsedFile {
  path: string;
  kind: FileKind;
  /** Raw file content (already size-capped / normalized by the engine). */
  content: string;
  /**
   * For Markdown-with-frontmatter kinds (`agent`, `command`): the parsed YAML
   * frontmatter data (or `undefined` if absent), the Markdown body, and the
   * 1-based line on which the body starts (so rules can map body offsets back
   * to file lines).
   */
  frontmatter?: ParsedFrontmatter;
  /**
   * For JSON kinds (`settings`, `mcp`): the tolerant parse result. `error` is
   * set when the JSON is unparseable; `value` is `undefined` in that case.
   */
  json?: ParsedJson;
}

/** Parsed YAML frontmatter + body split. */
export interface ParsedFrontmatter {
  /** Whether a `--- ... ---` frontmatter block was present. */
  hasFrontmatter: boolean;
  /** Parsed YAML data (object) or `undefined` when absent/empty. */
  data: Record<string, unknown> | undefined;
  /** A YAML parse error, if the frontmatter block failed to parse. */
  error?: ParseError;
  /** The Markdown body text following the frontmatter. */
  body: string;
  /** 1-based line in the original file where `body` begins. */
  bodyStartLine: number;
  /**
   * 1-based line where the frontmatter content (first YAML line) begins. Used
   * to map YAML node positions to file lines. `0` when no frontmatter.
   */
  frontmatterStartLine: number;
}

/** A parse error with a best-effort location. */
export interface ParseError {
  message: string;
  /** 1-based line. */
  line: number;
  /** 1-based column. */
  column: number;
}

/** Tolerant JSON parse result. Never throws; reports `error` instead. */
export interface ParsedJson {
  /** Parsed value, or `undefined` if `error` is set. */
  value: unknown;
  /** Parse error, if the input was not valid JSON. */
  error?: ParseError;
  /**
   * Maps a JSON path (array of object keys / array indices) to a 1-based
   * `{ line, column }` location in the source. Returns `undefined` if the path
   * cannot be located.
   */
  locate(path: ReadonlyArray<string | number>): { line: number; column: number } | undefined;
}

/** Static metadata describing a rule (for docs / the web catalog). */
export interface RuleMeta {
  title: string;
  description: string;
}

/** Context passed to a rule's `check`/`fix`. */
export interface RuleContext {
  file: ParsedFile;
  /**
   * Convenience: 1-based line/column for a character offset into
   * `file.content`. Used by rules that scan raw text.
   */
  offsetToLineColumn(offset: number): { line: number; column: number };
}

/**
 * A lint rule. Each rule targets one or more {@link FileKind}s and produces
 * {@link Finding}s. Rules are pure: they never execute, import, or fetch.
 */
export interface Rule {
  /** Stable id, e.g. `agent/invalid-name`. */
  id: string;
  /** Default severity (may be overridden via {@link LintOptions.rules}). */
  severity: Severity;
  /** Whether this rule can produce an autofix. */
  fixable: boolean;
  /** Docs slug for explanations. */
  docsSlug: string;
  /** File kinds this rule applies to. */
  appliesTo: ReadonlyArray<FileKind>;
  /** Static metadata for catalogs/docs. */
  meta: RuleMeta;
  /** Produce findings for the given context. Must never throw. */
  check(ctx: RuleContext): Finding[];
  /**
   * Produce a new full file content fixing the given finding, or `undefined`
   * if the finding cannot be safely fixed in the current state. Only present
   * on fixable rules.
   */
  fix?(ctx: RuleContext, finding: Finding): FixResult | undefined;
}
