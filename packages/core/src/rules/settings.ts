/**
 * Settings rules (`settings/*`) — SPEC §2.3 / §3.
 *
 * Targets `.claude/settings.json` and `.claude/settings.local.json`. These are
 * strict JSON. The high-bug area is `hooks`, which must be an object keyed by
 * event name, with string matchers.
 *
 * Autofixes here re-serialize the whole JSON document deterministically (2-space
 * indent). This is safe because settings files are pure data; reformatting does
 * not change semantics. Idempotency follows from deterministic serialization.
 */
import type { Rule, RuleContext, Finding, FixResult } from '../types.js';
import { HOOK_EVENTS, isValidModel, makeFinding, SETTINGS_MODEL_ALIASES } from './util.js';

const DOCS_BASE = 'settings';

/** Well-known top-level settings keys (for the unknown-key info rule). */
const KNOWN_TOP_KEYS: ReadonlySet<string> = new Set([
  'permissions',
  'hooks',
  'model',
  'env',
  'statusLine',
  'outputStyle',
  'includeCoAuthoredBy',
  'cleanupPeriodDays',
  'enableAllProjectMcpServers',
  'enabledMcpjsonServers',
  'disabledMcpjsonServers',
  'apiKeyHelper',
  'forceLoginMethod',
  'awsAuthRefresh',
  'awsCredentialExport',
  '$schema',
]);

/** Get the root JSON object, or undefined if not an object / parse failed. */
function rootObject(ctx: RuleContext): Record<string, unknown> | undefined {
  const json = ctx.file.json;
  if (!json || json.error) return undefined;
  const v = json.value;
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return undefined;
  return v as Record<string, unknown>;
}

/** Serialize a value as deterministic 2-space JSON with a trailing newline. */
function serialize(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n';
}

export const settingsRules: Rule[] = [
  {
    id: 'settings/invalid-json',
    severity: 'error',
    fixable: false,
    docsSlug: `${DOCS_BASE}/invalid-json`,
    appliesTo: ['settings'],
    meta: { title: 'settings.json is not valid JSON', description: 'The settings file must be strict JSON.' },
    check(ctx) {
      const json = ctx.file.json;
      if (json?.error) {
        return [makeFinding(this, ctx, `Invalid JSON: ${json.error.message}`, { line: json.error.line, column: json.error.column })];
      }
      if (json && (json.value === null || typeof json.value !== 'object' || Array.isArray(json.value))) {
        return [makeFinding(this, ctx, 'settings.json must be a JSON object at the top level.', { line: 1, column: 1 })];
      }
      return [];
    },
  },
  {
    id: 'settings/hooks-not-object',
    severity: 'error',
    fixable: true,
    docsSlug: `${DOCS_BASE}/hooks-not-object`,
    appliesTo: ['settings'],
    meta: {
      title: 'hooks must be an event-keyed object',
      description: 'Legacy/flat array hooks are not supported; `hooks` must be an object keyed by event name.',
    },
    check(ctx) {
      const root = rootObject(ctx);
      if (!root || !('hooks' in root)) return [];
      const hooks = root['hooks'];
      if (Array.isArray(hooks)) {
        const loc = ctx.file.json?.locate(['hooks']);
        return [makeFinding(this, ctx, 'The `hooks` field is an array; it must be an object keyed by event name (e.g. "PreToolUse").', loc)];
      }
      return [];
    },
    fix(ctx): FixResult | undefined {
      const root = rootObject(ctx);
      if (!root) return undefined;
      const hooks = root['hooks'];
      if (!Array.isArray(hooks)) return undefined;
      // Migrate a flat array into an event-keyed object. Each entry may already
      // carry an event hint; otherwise default to PreToolUse so a human can
      // re-key it. We preserve matcher/hooks shape.
      const migrated: Record<string, unknown[]> = {};
      for (const entry of hooks) {
        // Don't silently DROP malformed (non-object) array entries — that would
        // lose the user's data. Bail on the whole autofix so they keep the
        // original and fix it by hand.
        if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return undefined;
        const e = entry as Record<string, unknown>;
        const event = typeof e['event'] === 'string' && HOOK_EVENTS.has(e['event']) ? (e['event'] as string) : 'PreToolUse';
        const rest: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(e)) {
          if (k !== 'event') rest[k] = v;
        }
        (migrated[event] ??= []).push(rest);
      }
      const next = { ...root, hooks: migrated };
      return { content: serialize(next) };
    },
  },
  {
    id: 'settings/hook-matcher-not-string',
    severity: 'error',
    fixable: true,
    docsSlug: `${DOCS_BASE}/hook-matcher-not-string`,
    appliesTo: ['settings'],
    meta: {
      title: 'hook matcher must be a string',
      description: 'A hook `matcher` is a regex string over the tool name (or omitted), not an object like {toolName}.',
    },
    check(ctx) {
      const root = rootObject(ctx);
      if (!root) return [];
      const hooks = root['hooks'];
      if (hooks === null || typeof hooks !== 'object' || Array.isArray(hooks)) return [];
      const findings: Finding[] = [];
      for (const [event, groups] of Object.entries(hooks as Record<string, unknown>)) {
        if (!Array.isArray(groups)) continue;
        groups.forEach((group, gi) => {
          if (group === null || typeof group !== 'object') return;
          const matcher = (group as Record<string, unknown>)['matcher'];
          if (matcher !== undefined && typeof matcher !== 'string') {
            const loc = ctx.file.json?.locate(['hooks', event, gi, 'matcher']);
            findings.push(makeFinding(this, ctx, `Hook matcher under "${event}" must be a string, not ${Array.isArray(matcher) ? 'an array' : typeof matcher}.`, loc));
          }
        });
      }
      return findings;
    },
    fix(ctx): FixResult | undefined {
      const root = rootObject(ctx);
      if (!root) return undefined;
      const hooks = root['hooks'];
      if (hooks === null || typeof hooks !== 'object' || Array.isArray(hooks)) return undefined;
      let changed = false;
      const newHooks: Record<string, unknown> = {};
      for (const [event, groups] of Object.entries(hooks as Record<string, unknown>)) {
        if (!Array.isArray(groups)) {
          newHooks[event] = groups;
          continue;
        }
        newHooks[event] = groups.map((group) => {
          if (group === null || typeof group !== 'object') return group;
          const g = group as Record<string, unknown>;
          const matcher = g['matcher'];
          if (matcher !== undefined && typeof matcher !== 'string') {
            changed = true;
            // Best-effort coercion: pull a `toolName`/`tool` string if present,
            // else use empty matcher (matches all).
            let coerced = '';
            if (matcher && typeof matcher === 'object' && !Array.isArray(matcher)) {
              const mo = matcher as Record<string, unknown>;
              const cand = mo['toolName'] ?? mo['tool'] ?? mo['name'];
              if (typeof cand === 'string') coerced = cand;
            }
            return { ...g, matcher: coerced };
          }
          return group;
        });
      }
      if (!changed) return undefined;
      return { content: serialize({ ...root, hooks: newHooks }) };
    },
  },
  {
    id: 'settings/hook-matcher-invalid-regex',
    severity: 'warning',
    fixable: false,
    docsSlug: `${DOCS_BASE}/hook-matcher-invalid-regex`,
    appliesTo: ['settings'],
    meta: {
      title: 'Hook matcher is not a valid regular expression',
      description: 'A hook `matcher` is a regex over the tool name; an invalid pattern silently never matches, so the hook never fires.',
    },
    check(ctx) {
      const root = rootObject(ctx);
      if (!root) return [];
      const hooks = root['hooks'];
      if (hooks === null || typeof hooks !== 'object' || Array.isArray(hooks)) return [];
      const findings: Finding[] = [];
      for (const [event, groups] of Object.entries(hooks as Record<string, unknown>)) {
        if (!Array.isArray(groups)) continue;
        groups.forEach((group, gi) => {
          if (group === null || typeof group !== 'object') return;
          const matcher = (group as Record<string, unknown>)['matcher'];
          // Non-string matchers are handled by hook-matcher-not-string; an empty
          // string is the documented "match everything" form, so skip both.
          if (typeof matcher !== 'string' || matcher === '') return;
          try {
            // Size-capped input → no ReDoS-at-construction concern.
            new RegExp(matcher);
          } catch {
            const loc = ctx.file.json?.locate(['hooks', event, gi, 'matcher']);
            findings.push(makeFinding(this, ctx, `Hook matcher "${matcher}" under "${event}" is not a valid regular expression; this hook will never match and silently does nothing.`, loc));
          }
        });
      }
      return findings;
    },
  },
  {
    id: 'settings/hooks-unknown-event',
    severity: 'warning',
    fixable: false,
    docsSlug: `${DOCS_BASE}/hooks-unknown-event`,
    appliesTo: ['settings'],
    meta: { title: 'Unknown hook event name', description: `Valid events: ${[...HOOK_EVENTS].join(', ')}.` },
    check(ctx) {
      const root = rootObject(ctx);
      if (!root) return [];
      const hooks = root['hooks'];
      if (hooks === null || typeof hooks !== 'object' || Array.isArray(hooks)) return [];
      const findings: Finding[] = [];
      for (const event of Object.keys(hooks as Record<string, unknown>)) {
        if (!HOOK_EVENTS.has(event)) {
          const loc = ctx.file.json?.locate(['hooks', event]);
          findings.push(makeFinding(this, ctx, `Unknown hook event "${event}". Valid: ${[...HOOK_EVENTS].join(', ')}.`, loc));
        }
      }
      return findings;
    },
  },
  {
    id: 'settings/hook-missing-command',
    severity: 'error',
    fixable: false,
    docsSlug: `${DOCS_BASE}/hook-missing-command`,
    appliesTo: ['settings'],
    meta: {
      title: 'Hook handler is missing its command',
      description: 'Each hook handler must be `{ "type": "command", "command": "<shell>" }`.',
    },
    check(ctx) {
      const root = rootObject(ctx);
      if (!root) return [];
      const hooks = root['hooks'];
      if (hooks === null || typeof hooks !== 'object' || Array.isArray(hooks)) return [];
      const findings: Finding[] = [];
      for (const [event, groups] of Object.entries(hooks as Record<string, unknown>)) {
        if (!Array.isArray(groups)) continue;
        groups.forEach((group, gi) => {
          if (group === null || typeof group !== 'object') return;
          const handlers = (group as Record<string, unknown>)['hooks'];
          if (!Array.isArray(handlers)) {
            const loc = ctx.file.json?.locate(['hooks', event, gi]);
            findings.push(makeFinding(this, ctx, `Hook group under "${event}" has no "hooks" handler array.`, loc));
            return;
          }
          handlers.forEach((handler, hi) => {
            if (handler === null || typeof handler !== 'object') {
              const loc = ctx.file.json?.locate(['hooks', event, gi, 'hooks', hi]);
              findings.push(makeFinding(this, ctx, `Hook handler under "${event}" must be an object.`, loc));
              return;
            }
            const h = handler as Record<string, unknown>;
            if (h['type'] !== 'command' || typeof h['command'] !== 'string' || h['command'].trim() === '') {
              const loc = ctx.file.json?.locate(['hooks', event, gi, 'hooks', hi]);
              findings.push(makeFinding(this, ctx, `Hook handler under "${event}" must have type:"command" and a non-empty command.`, loc));
            }
          });
        });
      }
      return findings;
    },
  },
  {
    id: 'settings/invalid-model',
    severity: 'warning',
    fixable: true,
    docsSlug: `${DOCS_BASE}/invalid-model`,
    appliesTo: ['settings'],
    meta: { title: 'settings `model` is invalid', description: 'Use opus|sonnet|haiku|default or a pinned claude-* id (no -latest).' },
    check(ctx) {
      const root = rootObject(ctx);
      if (!root || !('model' in root)) return [];
      const model = root['model'];
      if (typeof model !== 'string') {
        const loc = ctx.file.json?.locate(['model']);
        return [makeFinding(this, ctx, `settings "model" must be a string.`, loc)];
      }
      if (!isValidModel(model, SETTINGS_MODEL_ALIASES)) {
        const loc = ctx.file.json?.locate(['model']);
        return [makeFinding(this, ctx, `settings model "${model}" is invalid. Use opus|sonnet|haiku|default or a pinned claude-* id (no -latest).`, loc)];
      }
      return [];
    },
    fix(ctx): FixResult | undefined {
      const root = rootObject(ctx);
      if (!root || !('model' in root)) return undefined;
      const model = root['model'];
      if (typeof model === 'string' && isValidModel(model, SETTINGS_MODEL_ALIASES)) return undefined;
      return { content: serialize({ ...root, model: 'default' }) };
    },
  },
  {
    id: 'settings/unknown-key',
    severity: 'info',
    fixable: false,
    docsSlug: `${DOCS_BASE}/unknown-key`,
    appliesTo: ['settings'],
    meta: { title: 'Unknown top-level settings key', description: 'A top-level key is not a recognized setting.' },
    check(ctx) {
      const root = rootObject(ctx);
      if (!root) return [];
      const findings: Finding[] = [];
      for (const key of Object.keys(root)) {
        if (!KNOWN_TOP_KEYS.has(key)) {
          const loc = ctx.file.json?.locate([key]);
          findings.push(makeFinding(this, ctx, `Unrecognized top-level settings key "${key}".`, loc));
        }
      }
      return findings;
    },
  },
];
