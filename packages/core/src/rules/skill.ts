/**
 * Agent Skill rules (`skill/*`) — Claude Code "Agent Skills".
 *
 * Targets `.claude/skills/<name>/SKILL.md`: YAML frontmatter (`name`,
 * `description`, optional `allowed-tools`/`license`/`metadata`/`model`/…) + a
 * Markdown body that is the skill's instructions.
 *
 * Key facts these rules encode (from the Agent Skills spec / Claude Code docs):
 *  - The file MUST be named exactly `SKILL.md` (case-sensitive) or Claude Code
 *    silently never loads it.
 *  - `name` is required, must match `^[a-z][a-z0-9-]*$`, be ≤ 64 chars, and
 *    match the parent skill directory name.
 *  - `description` is required and should say WHAT the skill does AND WHEN to
 *    use it (it drives discovery); the practical cap is ~1024 chars.
 *  - `allowed-tools` is optional; entries should be known tools and not grant
 *    unrestricted shell access.
 *
 * Every regex here is ReDoS-safe (anchored / bounded classes, no nested
 * quantifiers); the tool tokenizer is a single-pass char loop. Rules are pure —
 * they never execute, import, or fetch.
 */
import type { Finding, Rule, RuleContext } from '../types.js';
import { AGENT_MODEL_ALIASES, isValidModel, KNOWN_TOOLS, makeFinding } from './util.js';
import { replaceFrontmatterScalar, slugifyName } from './agent.js';

const DOCS_BASE = 'skill';

/** `name` charset (shared with subagents). ReDoS-safe: anchored, bounded run. */
const NAME_RE = /^[a-z][a-z0-9-]*$/;
/** Max length of a skill `name` per the spec. */
const MAX_NAME_LEN = 64;
/** Practical cap on `description` length (discovery is truncated past this). */
const MAX_DESC_LEN = 1024;

/**
 * Frontmatter keys recognized by the Agent Skills spec and Claude Code. Unknown
 * keys are warned about (likely typos, e.g. `allowed_tools` for `allowed-tools`).
 */
const KNOWN_KEYS: ReadonlySet<string> = new Set([
  // Spec fields.
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'allowed-tools',
  'version',
  'author',
  // Claude Code extensions.
  'model',
  'argument-hint',
  'user-invocable',
  'disable-model-invocation',
  'context',
  'effort',
  'when_to_use',
  'hooks',
]);

/**
 * Words that signal a description explains WHEN to use the skill. If none of
 * these appear we emit an `info` nudge (discovery quality). ReDoS-safe: a flat
 * alternation of literals, single bounded test.
 */
const TRIGGER_RE = /\b(use|when|whenever|if you|after|before|trigger|invoke|activate|relevant)\b/i;

/** Locate the 1-based file line of a top-level frontmatter key, if present. */
function frontmatterKeyLine(ctx: RuleContext, key: string): number | undefined {
  const fm = ctx.file.frontmatter;
  if (!fm || !fm.hasFrontmatter) return undefined;
  const lines = ctx.file.content.split('\n');
  const start = fm.frontmatterStartLine - 1;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (line === '---' || line === '...') break;
    // ReDoS-safe: anchored, single bounded class run.
    const m = line?.match(/^([A-Za-z0-9_-]+)\s*:/);
    if (m && m[1] === key) return i + 1;
  }
  return undefined;
}

/** The file basename, e.g. `.claude/skills/pdf/SKILL.md` → `SKILL.md`. */
function basename(filePath: string): string {
  return filePath.replace(/\\/g, '/').split('/').pop() ?? filePath;
}

/** The immediate parent directory name, e.g. `.../skills/pdf/SKILL.md` → `pdf`. */
function parentDirName(filePath: string): string | undefined {
  const parts = filePath.replace(/\\/g, '/').split('/');
  // parts: [..., '<dir>', 'SKILL.md'] — the dir is second-to-last.
  return parts.length >= 2 ? parts[parts.length - 2] : undefined;
}

/** Slugify + truncate to {@link MAX_NAME_LEN} so the fix yields a valid name. */
function normalizeSkillName(input: string): string {
  let s = slugifyName(input);
  if (s.length > MAX_NAME_LEN) s = s.slice(0, MAX_NAME_LEN).replace(/-+$/, '');
  return s;
}

/** A valid, ready-to-use skill name (pattern + length). */
function isValidSkillName(s: string): boolean {
  return NAME_RE.test(s) && s.length <= MAX_NAME_LEN;
}

/**
 * Tokenize an `allowed-tools` value into individual entries. Handles a YAML
 * list, a comma-separated string, and a space-separated string — and never
 * splits inside a `(...)` permission qualifier such as `Bash(git log:*)`.
 *
 * ReDoS-safe: a single linear pass over the characters with a paren-depth
 * counter; no regex backtracking.
 */
function tokenizeTools(raw: unknown): string[] {
  if (raw === undefined || raw === null) return [];
  const text = Array.isArray(raw) ? raw.map((x) => String(x)).join(' ') : String(raw);
  const tokens: string[] = [];
  let cur = '';
  let depth = 0;
  for (const ch of text) {
    if (ch === '(') {
      depth++;
      cur += ch;
    } else if (ch === ')') {
      if (depth > 0) depth--;
      cur += ch;
    } else if (depth === 0 && (ch === ',' || ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r')) {
      if (cur.trim() !== '') tokens.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim() !== '') tokens.push(cur.trim());
  return tokens;
}

export const skillRules: Rule[] = [
  {
    id: 'skill/missing-frontmatter',
    severity: 'error',
    fixable: false,
    docsSlug: `${DOCS_BASE}/missing-frontmatter`,
    appliesTo: ['skill'],
    meta: {
      title: 'Skill is missing YAML frontmatter',
      description:
        'A SKILL.md must begin with a `--- ... ---` YAML frontmatter block declaring at least `name` and `description`.',
    },
    check(ctx) {
      const fm = ctx.file.frontmatter;
      if (!fm || !fm.hasFrontmatter) {
        return [
          makeFinding(this, ctx, 'SKILL.md has no YAML frontmatter block (expected `--- ... ---`).', {
            line: 1,
            column: 1,
          }),
        ];
      }
      return [];
    },
  },
  {
    id: 'skill/invalid-frontmatter',
    severity: 'error',
    fixable: false,
    docsSlug: `${DOCS_BASE}/invalid-frontmatter`,
    appliesTo: ['skill'],
    meta: {
      title: 'Skill frontmatter failed to parse',
      description: 'The YAML frontmatter block contains a syntax error.',
    },
    check(ctx) {
      const fm = ctx.file.frontmatter;
      if (fm?.error) {
        return [
          makeFinding(this, ctx, `Invalid skill frontmatter: ${fm.error.message}`, {
            line: fm.error.line,
            column: fm.error.column,
          }),
        ];
      }
      return [];
    },
  },
  {
    id: 'skill/filename-not-canonical',
    severity: 'error',
    fixable: false,
    docsSlug: `${DOCS_BASE}/filename-not-canonical`,
    appliesTo: ['skill'],
    meta: {
      title: 'Skill file is not named exactly SKILL.md',
      description:
        'Claude Code only loads a skill from a case-sensitive `SKILL.md`. A file like `skill.md` or `Skill.md` is silently ignored.',
    },
    check(ctx) {
      const base = basename(ctx.file.path);
      if (base !== 'SKILL.md') {
        return [
          makeFinding(
            this,
            ctx,
            `Skill file is named "${base}"; it must be exactly "SKILL.md" (case-sensitive) or Claude Code will silently ignore the skill.`,
            { line: 1, column: 1 },
          ),
        ];
      }
      return [];
    },
  },
  {
    id: 'skill/missing-name',
    severity: 'error',
    fixable: false,
    docsSlug: `${DOCS_BASE}/missing-name`,
    appliesTo: ['skill'],
    meta: {
      title: 'Skill frontmatter is missing `name`',
      description: 'The `name` field is required and should match the skill directory name.',
    },
    check(ctx) {
      const fm = ctx.file.frontmatter;
      if (!fm || !fm.hasFrontmatter) return []; // missing-frontmatter covers it
      const name = fm.data ? fm.data['name'] : undefined;
      if (name === undefined || name === null || String(name).trim() === '') {
        return [makeFinding(this, ctx, 'Skill frontmatter is missing a `name`.', { line: fm.frontmatterStartLine })];
      }
      return [];
    },
  },
  {
    id: 'skill/invalid-name',
    severity: 'error',
    fixable: true,
    docsSlug: `${DOCS_BASE}/invalid-name`,
    appliesTo: ['skill'],
    meta: {
      title: 'Skill `name` is invalid',
      description: 'The `name` must match `^[a-z][a-z0-9-]*$` (lowercase letters, digits, hyphens) and be at most 64 characters.',
    },
    check(ctx) {
      const fm = ctx.file.frontmatter;
      if (!fm || !fm.data) return [];
      const name = fm.data['name'];
      if (name === undefined || name === null) return [];
      const str = String(name);
      if (str.trim() === '') return []; // handled by missing-name
      if (!isValidSkillName(str)) {
        const reason = str.length > MAX_NAME_LEN ? `it must be at most ${MAX_NAME_LEN} characters` : 'it must match ^[a-z][a-z0-9-]*$';
        const line = frontmatterKeyLine(ctx, 'name');
        return [
          makeFinding(
            this,
            ctx,
            `Skill name "${str}" is invalid; ${reason}. Suggested: "${normalizeSkillName(str)}".`,
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
      if (isValidSkillName(String(name))) return undefined;
      const content = replaceFrontmatterScalar(ctx, 'name', normalizeSkillName(String(name)));
      return content !== undefined ? { content } : undefined;
    },
  },
  {
    id: 'skill/name-dir-mismatch',
    severity: 'warning',
    fixable: true,
    docsSlug: `${DOCS_BASE}/name-dir-mismatch`,
    appliesTo: ['skill'],
    meta: {
      title: 'Skill `name` does not match its directory',
      description: 'The `name` must equal the parent skill directory name, or Claude Code may not discover the skill correctly.',
    },
    check(ctx) {
      const fm = ctx.file.frontmatter;
      if (!fm || !fm.data) return [];
      const name = fm.data['name'];
      if (name === undefined || name === null) return [];
      const str = String(name);
      if (!isValidSkillName(str)) return []; // invalid-name handles this
      const dir = parentDirName(ctx.file.path);
      if (dir === undefined || dir === '') return []; // cannot determine the directory
      if (str !== dir) {
        const line = frontmatterKeyLine(ctx, 'name');
        return [
          makeFinding(
            this,
            ctx,
            `Skill name "${str}" does not match its directory "${dir}". Rename the directory or the name so they match.`,
            line !== undefined ? { line } : undefined,
          ),
        ];
      }
      return [];
    },
    fix(ctx) {
      const fm = ctx.file.frontmatter;
      if (!fm || !fm.data) return undefined;
      const dir = parentDirName(ctx.file.path);
      // Only rewrite the name when the directory itself is a valid skill name —
      // otherwise we'd introduce an invalid name. (Renaming the directory is the
      // user's call; we never touch the filesystem.)
      if (dir === undefined || !isValidSkillName(dir)) return undefined;
      const content = replaceFrontmatterScalar(ctx, 'name', dir);
      return content !== undefined ? { content } : undefined;
    },
  },
  {
    id: 'skill/missing-description',
    severity: 'error',
    fixable: false,
    docsSlug: `${DOCS_BASE}/missing-description`,
    appliesTo: ['skill'],
    meta: {
      title: 'Skill frontmatter is missing `description`',
      description: 'The `description` is required; it is how Claude decides when to load the skill.',
    },
    check(ctx) {
      const fm = ctx.file.frontmatter;
      if (!fm || !fm.hasFrontmatter) return [];
      const desc = fm.data ? fm.data['description'] : undefined;
      if (desc === undefined || desc === null || String(desc).trim() === '') {
        const line = frontmatterKeyLine(ctx, 'description') ?? fm.frontmatterStartLine;
        return [makeFinding(this, ctx, 'Skill frontmatter is missing a non-empty `description`.', { line })];
      }
      return [];
    },
  },
  {
    id: 'skill/description-too-long',
    severity: 'warning',
    fixable: false,
    docsSlug: `${DOCS_BASE}/description-too-long`,
    appliesTo: ['skill'],
    meta: {
      title: 'Skill `description` is too long',
      description: `The \`description\` should be at most ${MAX_DESC_LEN} characters; longer text is truncated for discovery and wastes context.`,
    },
    check(ctx) {
      const fm = ctx.file.frontmatter;
      if (!fm || !fm.data) return [];
      const desc = fm.data['description'];
      if (desc === undefined || desc === null) return [];
      const str = String(desc);
      if (str.length > MAX_DESC_LEN) {
        const line = frontmatterKeyLine(ctx, 'description');
        return [
          makeFinding(
            this,
            ctx,
            `Skill description is ${str.length} characters; keep it at or under ${MAX_DESC_LEN}. Move detail into the body or reference files.`,
            line !== undefined ? { line } : undefined,
          ),
        ];
      }
      return [];
    },
  },
  {
    id: 'skill/description-missing-trigger',
    severity: 'info',
    fixable: false,
    docsSlug: `${DOCS_BASE}/description-missing-trigger`,
    appliesTo: ['skill'],
    meta: {
      title: 'Skill `description` does not say when to use the skill',
      description:
        'A good description states WHAT the skill does AND WHEN to use it (e.g. "Use when…"). Without a trigger phrase Claude may not load the skill at the right time.',
    },
    check(ctx) {
      const fm = ctx.file.frontmatter;
      if (!fm || !fm.data) return [];
      const desc = fm.data['description'];
      if (desc === undefined || desc === null) return [];
      const str = String(desc).trim();
      if (str === '') return []; // missing-description handles emptiness
      if (str.length > MAX_DESC_LEN) return []; // description-too-long handles this
      if (!TRIGGER_RE.test(str)) {
        const line = frontmatterKeyLine(ctx, 'description');
        return [
          makeFinding(
            this,
            ctx,
            'Skill description does not indicate WHEN to use the skill. Add a trigger phrase like "Use when…" so Claude can discover it.',
            line !== undefined ? { line } : undefined,
          ),
        ];
      }
      return [];
    },
  },
  {
    id: 'skill/unknown-key',
    severity: 'warning',
    fixable: false,
    docsSlug: `${DOCS_BASE}/unknown-key`,
    appliesTo: ['skill'],
    meta: {
      title: 'Skill frontmatter has an unknown key',
      description: `Only ${[...KNOWN_KEYS].join(', ')} are recognized. A typo here (e.g. \`allowed_tools\`) is silently ignored.`,
    },
    check(ctx) {
      const fm = ctx.file.frontmatter;
      if (!fm || !fm.data) return [];
      const findings: Finding[] = [];
      for (const key of Object.keys(fm.data)) {
        if (KNOWN_KEYS.has(key)) continue;
        const line = frontmatterKeyLine(ctx, key);
        findings.push(
          makeFinding(
            this,
            ctx,
            `Unknown skill frontmatter key "${key}". Allowed: ${[...KNOWN_KEYS].join(', ')}.`,
            line !== undefined ? { line } : undefined,
          ),
        );
      }
      return findings;
    },
  },
  {
    id: 'skill/metadata-reserved-key',
    severity: 'info',
    fixable: false,
    docsSlug: `${DOCS_BASE}/metadata-reserved-key`,
    appliesTo: ['skill'],
    meta: {
      title: 'Reserved field nested under `metadata`',
      description:
        '`version`, `author`, and `license` should be top-level frontmatter keys; nesting them under `metadata` can break marketplace validators that only read them at the top level.',
    },
    check(ctx) {
      const fm = ctx.file.frontmatter;
      if (!fm || !fm.data) return [];
      const meta = fm.data['metadata'];
      if (meta === null || typeof meta !== 'object' || Array.isArray(meta)) return [];
      const findings: Finding[] = [];
      const line = frontmatterKeyLine(ctx, 'metadata');
      for (const key of ['version', 'author', 'license']) {
        if (Object.prototype.hasOwnProperty.call(meta, key)) {
          findings.push(
            makeFinding(
              this,
              ctx,
              `"${key}" is nested under metadata; move it to a top-level frontmatter key (some marketplace validators only read it there).`,
              line !== undefined ? { line } : undefined,
            ),
          );
        }
      }
      return findings;
    },
  },
  {
    id: 'skill/invalid-model',
    severity: 'warning',
    fixable: false,
    docsSlug: `${DOCS_BASE}/invalid-model`,
    appliesTo: ['skill'],
    meta: {
      title: 'Skill `model` is invalid',
      description: 'When present, `model` must be one of inherit|opus|sonnet|haiku or a pinned claude-* id (no -latest).',
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
            `Skill model "${str}" is invalid. Use inherit|opus|sonnet|haiku or a pinned claude-* id (no -latest).`,
            line !== undefined ? { line } : undefined,
          ),
        ];
      }
      return [];
    },
  },
  {
    id: 'skill/unknown-allowed-tool',
    severity: 'warning',
    fixable: false,
    docsSlug: `${DOCS_BASE}/unknown-allowed-tool`,
    appliesTo: ['skill'],
    meta: {
      title: 'Skill references an unknown tool',
      description:
        'Each `allowed-tools` entry should be a known Claude Code tool (optionally with a `(...)` qualifier) or an `mcp__*` tool.',
    },
    check(ctx) {
      const fm = ctx.file.frontmatter;
      if (!fm || !fm.data) return [];
      const raw = fm.data['allowed-tools'];
      if (raw === undefined || raw === null) return [];
      const findings: Finding[] = [];
      const line = frontmatterKeyLine(ctx, 'allowed-tools');
      for (const entry of tokenizeTools(raw)) {
        // Strip a trailing `(...)` qualifier: `Bash(git status:*)` → `Bash`.
        const base = (entry.split('(')[0] ?? entry).trim();
        if (base === '' || base === '*') continue; // '*' handled by broad-allowed-tools
        if (KNOWN_TOOLS.has(base)) continue;
        if (base.startsWith('mcp__')) continue;
        findings.push(
          makeFinding(
            this,
            ctx,
            `Skill references unknown tool "${base}". Known tools: ${[...KNOWN_TOOLS].join(', ')} (or mcp__*).`,
            line !== undefined ? { line } : undefined,
          ),
        );
      }
      return findings;
    },
  },
  {
    id: 'skill/broad-allowed-tools',
    severity: 'warning',
    fixable: false,
    docsSlug: `${DOCS_BASE}/broad-allowed-tools`,
    appliesTo: ['skill'],
    meta: {
      title: 'Skill grants overly broad tool access',
      description: 'An `allowed-tools` entry of "*", "Bash", or "Bash(*)" pre-approves unrestricted shell access. Scope it (e.g. Bash(git status:*)).',
    },
    check(ctx) {
      const fm = ctx.file.frontmatter;
      if (!fm || !fm.data) return [];
      const raw = fm.data['allowed-tools'];
      if (raw === undefined || raw === null) return [];
      const findings: Finding[] = [];
      const line = frontmatterKeyLine(ctx, 'allowed-tools');
      for (const entry of tokenizeTools(raw)) {
        const trimmed = entry.trim();
        // ReDoS-safe: anchored, fixed/bounded class, no nesting.
        const broad = trimmed === '*' || trimmed === 'Bash' || /^Bash\(\s*:?\*\s*\)$/.test(trimmed);
        if (broad) {
          findings.push(
            makeFinding(
              this,
              ctx,
              `Skill pre-approves overly broad tool access "${trimmed}"; scope it (e.g. Bash(git status:*)).`,
              line !== undefined ? { line } : undefined,
            ),
          );
        }
      }
      return findings;
    },
  },
  {
    id: 'skill/empty-body',
    severity: 'error',
    fixable: false,
    docsSlug: `${DOCS_BASE}/empty-body`,
    appliesTo: ['skill'],
    meta: {
      title: 'Skill has an empty body',
      description: 'The Markdown body after the frontmatter holds the skill instructions and must be non-empty.',
    },
    check(ctx) {
      const fm = ctx.file.frontmatter;
      const body = fm ? fm.body : ctx.file.content;
      if (body.trim() === '') {
        const line = fm ? fm.bodyStartLine : 1;
        return [makeFinding(this, ctx, 'Skill has no instructions body after the frontmatter.', { line })];
      }
      return [];
    },
  },
];
