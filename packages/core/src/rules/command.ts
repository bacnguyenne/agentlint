/**
 * Slash command rules (`command/*`) — SPEC §2.2 / §3.
 *
 * Targets `.claude/commands/**\/*.md`. Frontmatter is OPTIONAL here; when
 * present only a known set of keys is allowed.
 */
import type { Rule, RuleContext, Finding } from '../types.js';
import { isValidModel, KNOWN_TOOLS, makeFinding, SETTINGS_MODEL_ALIASES } from './util.js';
import { replaceFrontmatterScalar } from './agent.js';

const DOCS_BASE = 'command';

/** Allowed frontmatter keys for slash commands. */
const ALLOWED_KEYS: ReadonlySet<string> = new Set([
  'description',
  'argument-hint',
  'allowed-tools',
  'model',
  'disable-model-invocation',
]);

/** Locate the 1-based file line of a top-level frontmatter key. */
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

export const commandRules: Rule[] = [
  {
    id: 'command/invalid-frontmatter',
    severity: 'error',
    fixable: false,
    docsSlug: `${DOCS_BASE}/invalid-frontmatter`,
    appliesTo: ['command'],
    meta: {
      title: 'Slash command frontmatter failed to parse',
      description: 'The optional YAML frontmatter block contains a syntax error.',
    },
    check(ctx) {
      const fm = ctx.file.frontmatter;
      if (fm?.error) {
        return [makeFinding(this, ctx, `Invalid command frontmatter: ${fm.error.message}`, { line: fm.error.line, column: fm.error.column })];
      }
      return [];
    },
  },
  {
    id: 'command/unknown-key',
    severity: 'warning',
    fixable: false,
    docsSlug: `${DOCS_BASE}/unknown-key`,
    appliesTo: ['command'],
    meta: {
      title: 'Slash command frontmatter has an unknown key',
      description: `Only ${[...ALLOWED_KEYS].join(', ')} are recognized.`,
    },
    check(ctx) {
      const fm = ctx.file.frontmatter;
      if (!fm || !fm.data) return [];
      const findings: Finding[] = [];
      for (const key of Object.keys(fm.data)) {
        if (!ALLOWED_KEYS.has(key)) {
          const line = frontmatterKeyLine(ctx, key);
          findings.push(
            makeFinding(
              this,
              ctx,
              `Unknown command frontmatter key "${key}". Allowed: ${[...ALLOWED_KEYS].join(', ')}.`,
              line !== undefined ? { line } : undefined,
            ),
          );
        }
      }
      return findings;
    },
  },
  {
    id: 'command/empty-body',
    severity: 'error',
    fixable: false,
    docsSlug: `${DOCS_BASE}/empty-body`,
    appliesTo: ['command'],
    meta: {
      title: 'Slash command has an empty body',
      description: 'A slash command must have a non-empty body (the prompt template).',
    },
    check(ctx) {
      const fm = ctx.file.frontmatter;
      const body = fm ? fm.body : ctx.file.content;
      if (body.trim() === '') {
        const line = fm ? fm.bodyStartLine : 1;
        return [makeFinding(this, ctx, 'Slash command has no body (prompt template is empty).', { line })];
      }
      return [];
    },
  },
  {
    id: 'command/invalid-model',
    severity: 'warning',
    fixable: true,
    docsSlug: `${DOCS_BASE}/invalid-model`,
    appliesTo: ['command'],
    meta: {
      title: 'Slash command `model` is invalid',
      description: 'The `model` must be opus|sonnet|haiku|default or a valid claude-* id without -latest.',
    },
    check(ctx) {
      const fm = ctx.file.frontmatter;
      if (!fm || !fm.data) return [];
      const model = fm.data['model'];
      if (model === undefined || model === null) return [];
      const str = String(model);
      if (!isValidModel(str, SETTINGS_MODEL_ALIASES)) {
        const line = frontmatterKeyLine(ctx, 'model');
        return [
          makeFinding(
            this,
            ctx,
            `Command model "${str}" is invalid. Use opus|sonnet|haiku|default or a pinned claude-* id (no -latest).`,
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
      if (isValidModel(String(model), SETTINGS_MODEL_ALIASES)) return undefined;
      const content = replaceFrontmatterScalar(ctx, 'model', 'default');
      return content !== undefined ? { content } : undefined;
    },
  },
  {
    id: 'command/unknown-allowed-tool',
    severity: 'warning',
    fixable: false,
    docsSlug: `${DOCS_BASE}/unknown-allowed-tool`,
    appliesTo: ['command'],
    meta: {
      title: 'Slash command references an unknown tool',
      description:
        'Each `allowed-tools` entry should be a known Claude Code tool (optionally with a `(...)` qualifier) or an `mcp__*` tool.',
    },
    check(ctx) {
      const fm = ctx.file.frontmatter;
      if (!fm || !fm.data) return [];
      const raw = fm.data['allowed-tools'];
      if (raw === undefined || raw === null) return [];
      // `allowed-tools` may be a YAML list or a comma-separated string.
      const entries: string[] = Array.isArray(raw)
        ? raw.map((t) => String(t).trim()).filter((t) => t.length > 0)
        : typeof raw === 'string'
          ? raw.split(',').map((t) => t.trim()).filter((t) => t.length > 0)
          : [];
      const findings: Finding[] = [];
      const line = frontmatterKeyLine(ctx, 'allowed-tools');
      for (const entry of entries) {
        // Strip a trailing `(...)` permission qualifier: `Bash(git status:*)` → `Bash`.
        const base = (entry.split('(')[0] ?? entry).trim();
        if (base === '') continue;
        if (KNOWN_TOOLS.has(base)) continue;
        if (base.startsWith('mcp__')) continue;
        findings.push(
          makeFinding(
            this,
            ctx,
            `Slash command references unknown tool "${base}". Known tools: ${[...KNOWN_TOOLS].join(', ')} (or mcp__*).`,
            line !== undefined ? { line } : undefined,
          ),
        );
      }
      return findings;
    },
  },
];
