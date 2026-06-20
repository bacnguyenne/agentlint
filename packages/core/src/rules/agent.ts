/**
 * Subagent rules (`agent/*`) — SPEC §2.1 / §3.
 *
 * Targets `.claude/agents/<name>.md` files: YAML frontmatter + a Markdown body
 * that is the system prompt.
 */
import type { Finding, Rule, RuleContext } from '../types.js';
import {
  AGENT_MODEL_ALIASES,
  isValidModel,
  KNOWN_TOOLS,
  makeFinding,
} from './util.js';

const DOCS_BASE = 'agent';

/** Locate the 1-based file line of a top-level frontmatter key, if present. */
function frontmatterKeyLine(ctx: RuleContext, key: string): number | undefined {
  const fm = ctx.file.frontmatter;
  if (!fm || !fm.hasFrontmatter) return undefined;
  // Frontmatter content begins at file line `frontmatterStartLine`. We scan the
  // original content lines within the frontmatter region for `key:`.
  const lines = ctx.file.content.split('\n');
  const start = fm.frontmatterStartLine - 1; // 0-based index of first YAML line
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (line === '---' || line === '...') break;
    // Match `key:` at column 0 (top-level). ReDoS-safe: anchored, single
    // bounded class run for the key, no nested quantifiers.
    const m = line?.match(/^([A-Za-z0-9_-]+)\s*:/);
    if (m && m[1] === key) return i + 1; // 1-based
  }
  return undefined;
}

/** Derive the expected agent name from the file path basename. */
function basenameNoExt(filePath: string): string {
  const base = filePath.replace(/\\/g, '/').split('/').pop() ?? filePath;
  return base.replace(/\.md$/i, '');
}

/** Slugify an arbitrary name into a valid `^[a-z][a-z0-9-]*$` identifier. */
export function slugifyName(input: string): string {
  let s = input
    .toLowerCase()
    .normalize('NFKD')
    // Replace any run of non [a-z0-9] with a single hyphen. ReDoS-safe: single
    // bounded class run, no nesting.
    .replace(/[^a-z0-9]+/g, '-')
    // Trim leading/trailing hyphens.
    .replace(/^-+/, '')
    .replace(/-+$/, '');
  // Must start with a letter.
  if (!/^[a-z]/.test(s)) s = `agent-${s}`;
  if (s === '' || s === 'agent-') s = 'agent';
  return s;
}

/** Extract `tools` as a normalized string list (handles CSV and YAML list). */
function extractTools(data: Record<string, unknown>): string[] | undefined {
  const raw = data['tools'];
  if (raw === undefined || raw === null) return undefined;
  if (Array.isArray(raw)) return raw.map((t) => String(t).trim()).filter((t) => t.length > 0);
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }
  return [];
}

const NAME_RE = /^[a-z][a-z0-9-]*$/; // ReDoS-safe: anchored, bounded class run.

export const agentRules: Rule[] = [
  {
    id: 'agent/missing-frontmatter',
    severity: 'error',
    fixable: false,
    docsSlug: `${DOCS_BASE}/missing-frontmatter`,
    appliesTo: ['agent'],
    meta: {
      title: 'Subagent is missing YAML frontmatter',
      description:
        'A subagent file must begin with a `--- ... ---` YAML frontmatter block declaring at least `name` and `description`.',
    },
    check(ctx) {
      const fm = ctx.file.frontmatter;
      if (!fm || !fm.hasFrontmatter) {
        return [
          makeFinding(this, ctx, 'Subagent file has no YAML frontmatter block (expected `--- ... ---`).', {
            line: 1,
            column: 1,
          }),
        ];
      }
      return [];
    },
  },
  {
    id: 'agent/missing-name',
    severity: 'error',
    fixable: false,
    docsSlug: `${DOCS_BASE}/missing-name`,
    appliesTo: ['agent'],
    meta: {
      title: 'Subagent frontmatter is missing `name`',
      description: 'The `name` field is required and is how the subagent is referenced.',
    },
    check(ctx) {
      const fm = ctx.file.frontmatter;
      // "No frontmatter at all" is handled by agent/missing-frontmatter.
      if (!fm || !fm.hasFrontmatter) return [];
      // An EMPTY frontmatter block (`---\n---`) yields `data === undefined`;
      // treat that the same as a missing `name` key.
      const name = fm.data ? fm.data['name'] : undefined;
      if (name === undefined || name === null || String(name).trim() === '') {
        return [makeFinding(this, ctx, 'Subagent frontmatter is missing a `name`.', { line: fm.frontmatterStartLine })];
      }
      return [];
    },
  },
  {
    id: 'agent/invalid-name',
    severity: 'error',
    fixable: true,
    docsSlug: `${DOCS_BASE}/invalid-name`,
    appliesTo: ['agent'],
    meta: {
      title: 'Subagent `name` is invalid',
      description: 'The `name` must match `^[a-z][a-z0-9-]*$` (lowercase letters, digits, hyphens).',
    },
    check(ctx) {
      const fm = ctx.file.frontmatter;
      if (!fm || !fm.data) return [];
      const name = fm.data['name'];
      if (name === undefined || name === null) return [];
      const str = String(name);
      if (str.trim() === '') return []; // handled by missing-name
      if (!NAME_RE.test(str)) {
        const line = frontmatterKeyLine(ctx, 'name');
        return [
          makeFinding(
            this,
            ctx,
            `Subagent name "${str}" is invalid; it must match ^[a-z][a-z0-9-]*$. Suggested: "${slugifyName(str)}".`,
            line !== undefined ? { line } : undefined,
          ),
        ];
      }
      return [];
    },
    fix(ctx) {
      const fm = ctx.file.frontmatter;
      if (!fm || !fm.data) return undefined;
      const name = fm.data['name'];
      if (name === undefined || name === null) return undefined;
      const slug = slugifyName(String(name));
      const content = replaceFrontmatterScalar(ctx, 'name', slug);
      return content !== undefined ? { content } : undefined;
    },
  },
  {
    id: 'agent/name-filename-mismatch',
    severity: 'warning',
    fixable: true,
    docsSlug: `${DOCS_BASE}/name-filename-mismatch`,
    appliesTo: ['agent'],
    meta: {
      title: 'Subagent `name` does not match its filename',
      description: 'By convention the `name` should equal the file basename so the agent is easy to locate.',
    },
    check(ctx) {
      const fm = ctx.file.frontmatter;
      if (!fm || !fm.data) return [];
      const name = fm.data['name'];
      if (name === undefined || name === null) return [];
      const str = String(name);
      if (!NAME_RE.test(str)) return []; // invalid-name handles this
      const expected = basenameNoExt(ctx.file.path);
      if (str !== expected) {
        const line = frontmatterKeyLine(ctx, 'name');
        return [
          makeFinding(
            this,
            ctx,
            `Subagent name "${str}" does not match filename "${expected}".`,
            line !== undefined ? { line } : undefined,
          ),
        ];
      }
      return [];
    },
    fix(ctx) {
      const fm = ctx.file.frontmatter;
      if (!fm || !fm.data) return undefined;
      const expected = basenameNoExt(ctx.file.path);
      if (!NAME_RE.test(expected)) return undefined; // don't create an invalid name
      const content = replaceFrontmatterScalar(ctx, 'name', expected);
      return content !== undefined ? { content } : undefined;
    },
  },
  {
    id: 'agent/missing-description',
    severity: 'error',
    fixable: false,
    docsSlug: `${DOCS_BASE}/missing-description`,
    appliesTo: ['agent'],
    meta: {
      title: 'Subagent frontmatter is missing `description`',
      description: 'The `description` drives auto-delegation and is required.',
    },
    check(ctx) {
      const fm = ctx.file.frontmatter;
      // "No frontmatter at all" is handled by agent/missing-frontmatter.
      if (!fm || !fm.hasFrontmatter) return [];
      // An EMPTY frontmatter block (`---\n---`) yields `data === undefined`;
      // treat that the same as a missing `description` key.
      const desc = fm.data ? fm.data['description'] : undefined;
      if (desc === undefined || desc === null || String(desc).trim() === '') {
        const line = frontmatterKeyLine(ctx, 'description') ?? fm.frontmatterStartLine;
        return [makeFinding(this, ctx, 'Subagent frontmatter is missing a non-empty `description`.', { line })];
      }
      return [];
    },
  },
  {
    id: 'agent/unknown-tool',
    severity: 'warning',
    fixable: false,
    docsSlug: `${DOCS_BASE}/unknown-tool`,
    appliesTo: ['agent'],
    meta: {
      title: 'Subagent references an unknown tool',
      description:
        'The `tools` list should only contain known Claude Code tools or `mcp__*` server tools.',
    },
    check(ctx) {
      const fm = ctx.file.frontmatter;
      if (!fm || !fm.data) return [];
      const tools = extractTools(fm.data);
      if (!tools) return [];
      const findings: Finding[] = [];
      const line = frontmatterKeyLine(ctx, 'tools');
      for (const tool of tools) {
        if (KNOWN_TOOLS.has(tool)) continue;
        if (tool.startsWith('mcp__')) continue;
        findings.push(
          makeFinding(
            this,
            ctx,
            `Subagent references unknown tool "${tool}". Known tools: ${[...KNOWN_TOOLS].join(', ')} (or mcp__*).`,
            line !== undefined ? { line } : undefined,
          ),
        );
      }
      return findings;
    },
  },
  {
    id: 'agent/invalid-model',
    severity: 'error',
    fixable: true,
    docsSlug: `${DOCS_BASE}/invalid-model`,
    appliesTo: ['agent'],
    meta: {
      title: 'Subagent `model` is invalid',
      description:
        'The `model` must be one of inherit|opus|sonnet|haiku or a valid claude-* id without a -latest suffix.',
    },
    check(ctx) {
      const fm = ctx.file.frontmatter;
      if (!fm || !fm.data) return [];
      const model = fm.data['model'];
      if (model === undefined || model === null) return [];
      const str = String(model);
      if (!isValidModel(str, AGENT_MODEL_ALIASES)) {
        const line = frontmatterKeyLine(ctx, 'model');
        return [
          makeFinding(
            this,
            ctx,
            `Subagent model "${str}" is invalid. Use inherit|opus|sonnet|haiku or a pinned claude-* id (no -latest).`,
            line !== undefined ? { line } : undefined,
          ),
        ];
      }
      return [];
    },
    fix(ctx) {
      const fm = ctx.file.frontmatter;
      if (!fm || !fm.data) return undefined;
      const model = fm.data['model'];
      if (model === undefined || model === null) return undefined;
      if (isValidModel(String(model), AGENT_MODEL_ALIASES)) return undefined;
      const content = replaceFrontmatterScalar(ctx, 'model', 'inherit');
      return content !== undefined ? { content } : undefined;
    },
  },
  {
    id: 'agent/empty-body',
    severity: 'error',
    fixable: false,
    docsSlug: `${DOCS_BASE}/empty-body`,
    appliesTo: ['agent'],
    meta: {
      title: 'Subagent has an empty body',
      description: 'The Markdown body after the frontmatter is the system prompt and must be non-empty.',
    },
    check(ctx) {
      const fm = ctx.file.frontmatter;
      // If there's no frontmatter at all, missing-frontmatter covers it; still
      // flag an empty body if the whole file is blank.
      const body = fm ? fm.body : ctx.file.content;
      if (body.trim() === '') {
        const line = fm ? fm.bodyStartLine : 1;
        return [makeFinding(this, ctx, 'Subagent has no system-prompt body after the frontmatter.', { line })];
      }
      return [];
    },
  },
];

/**
 * Replace a top-level scalar value in the frontmatter region and return the new
 * full file content. Returns `undefined` if the key line cannot be found.
 *
 * This is a conservative text edit: it rewrites the `key: <value>` line,
 * preserving indentation and any trailing comment. It only handles top-level
 * scalar keys (sufficient for name/model fixes).
 */
function replaceFrontmatterScalar(
  ctx: RuleContext,
  key: string,
  newValue: string,
): string | undefined {
  const fm = ctx.file.frontmatter;
  if (!fm || !fm.hasFrontmatter) return undefined;
  const lines = ctx.file.content.split('\n');
  const start = fm.frontmatterStartLine - 1;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (line === '---' || line === '...') break;
    // ReDoS-safe: anchored, bounded class for key + lazy-free capture of the
    // rest is a single bounded `.*` (no nesting).
    const m = line?.match(/^(\s*)([A-Za-z0-9_-]+)(\s*:\s*)(.*)$/);
    if (m && m[2] === key) {
      const indent = m[1];
      const sep = m[3];
      const rest = m[4] ?? '';
      // Preserve a trailing line comment (e.g. `name: x  # generated`). Only when
      // the old value is a simple UNQUOTED scalar with no embedded `#` — that way
      // we never split a `#` that lives inside a quoted YAML string.
      // ReDoS-safe: disjoint adjacent classes (`[^\s#'"]+` then `\s+`), no nesting.
      const cm = rest.match(/^[^\s#'"]+(\s+#.*)$/);
      const trailingComment = cm ? cm[1] : '';
      // Quote the value if it contains characters that need quoting in YAML.
      const quoted = needsYamlQuote(newValue) ? JSON.stringify(newValue) : newValue;
      lines[i] = `${indent}${key}${sep}${quoted}${trailingComment}`;
      return lines.join('\n');
    }
  }
  return undefined;
}

/** Whether a YAML scalar value needs double-quoting to be safe. */
function needsYamlQuote(value: string): boolean {
  // Quote if it contains YAML-significant chars or leading/trailing space.
  // ReDoS-safe: single bounded class test, no nesting.
  return /[:#{}\[\],&*!|>'"%@`]/.test(value) || /^\s|\s$/.test(value) || value === '';
}

export { replaceFrontmatterScalar };
