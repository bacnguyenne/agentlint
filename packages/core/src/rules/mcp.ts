/**
 * MCP rules (`mcp/*`) — SPEC §2.4 / §3.
 *
 * Targets `.mcp.json` at the repo root. Strict JSON with a top-level
 * `mcpServers` object map.
 */
import type { Rule, RuleContext, Finding, FixResult } from '../types.js';
import { isSecretKeyName, makeFinding } from './util.js';

const DOCS_BASE = 'mcp';

/** Expected keys inside a server entry (for the unknown-key info rule). */
const KNOWN_SERVER_KEYS: ReadonlySet<string> = new Set([
  'command',
  'args',
  'env',
  'type',
  'url',
  'headers',
]);

function rootObject(ctx: RuleContext): Record<string, unknown> | undefined {
  const json = ctx.file.json;
  if (!json || json.error) return undefined;
  const v = json.value;
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return undefined;
  return v as Record<string, unknown>;
}

function serialize(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n';
}

export const mcpRules: Rule[] = [
  {
    id: 'mcp/invalid-json',
    severity: 'error',
    fixable: false,
    docsSlug: `${DOCS_BASE}/invalid-json`,
    appliesTo: ['mcp'],
    meta: { title: '.mcp.json is not valid JSON', description: 'The MCP config must be strict JSON.' },
    check(ctx) {
      const json = ctx.file.json;
      if (json?.error) {
        return [makeFinding(this, ctx, `Invalid JSON: ${json.error.message}`, { line: json.error.line, column: json.error.column })];
      }
      if (json && (json.value === null || typeof json.value !== 'object' || Array.isArray(json.value))) {
        return [makeFinding(this, ctx, '.mcp.json must be a JSON object at the top level.', { line: 1, column: 1 })];
      }
      return [];
    },
  },
  {
    id: 'mcp/missing-mcpservers',
    severity: 'error',
    fixable: false,
    docsSlug: `${DOCS_BASE}/missing-mcpservers`,
    appliesTo: ['mcp'],
    meta: { title: '.mcp.json is missing `mcpServers`', description: 'The top-level `mcpServers` object is required.' },
    check(ctx) {
      const root = rootObject(ctx);
      if (!root) return [];
      if (!('mcpServers' in root)) {
        return [makeFinding(this, ctx, '.mcp.json is missing the required top-level "mcpServers" object.', { line: 1, column: 1 })];
      }
      return [];
    },
  },
  {
    id: 'mcp/mcpservers-is-array',
    severity: 'error',
    fixable: true,
    docsSlug: `${DOCS_BASE}/mcpservers-is-array`,
    appliesTo: ['mcp'],
    meta: { title: '`mcpServers` must be an object map', description: '`mcpServers` is an array; it must be an object keyed by server name.' },
    check(ctx) {
      const root = rootObject(ctx);
      if (!root || !('mcpServers' in root)) return [];
      if (Array.isArray(root['mcpServers'])) {
        const loc = ctx.file.json?.locate(['mcpServers']);
        return [makeFinding(this, ctx, '`mcpServers` is an array; it must be an object keyed by server name.', loc)];
      }
      return [];
    },
    fix(ctx): FixResult | undefined {
      const root = rootObject(ctx);
      if (!root) return undefined;
      const servers = root['mcpServers'];
      if (!Array.isArray(servers)) return undefined;
      const map: Record<string, unknown> = {};
      servers.forEach((entry, i) => {
        if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
          map[`server-${i + 1}`] = entry;
          return;
        }
        const e = entry as Record<string, unknown>;
        const name = typeof e['name'] === 'string' && e['name'].trim() !== '' ? (e['name'] as string) : `server-${i + 1}`;
        const rest: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(e)) if (k !== 'name') rest[k] = v;
        map[name] = rest;
      });
      return { content: serialize({ ...root, mcpServers: map }) };
    },
  },
  {
    id: 'mcp/server-missing-endpoint',
    severity: 'error',
    fixable: false,
    docsSlug: `${DOCS_BASE}/server-missing-endpoint`,
    appliesTo: ['mcp'],
    meta: { title: 'MCP server has no endpoint', description: 'Each server must define either a `command` (stdio) or a `url` (remote).' },
    check(ctx) {
      const root = rootObject(ctx);
      if (!root) return [];
      const servers = root['mcpServers'];
      if (servers === null || typeof servers !== 'object' || Array.isArray(servers)) return [];
      const findings: Finding[] = [];
      for (const [name, server] of Object.entries(servers as Record<string, unknown>)) {
        if (server === null || typeof server !== 'object' || Array.isArray(server)) {
          const loc = ctx.file.json?.locate(['mcpServers', name]);
          findings.push(makeFinding(this, ctx, `MCP server "${name}" must be an object.`, loc));
          continue;
        }
        const s = server as Record<string, unknown>;
        const hasCommand = typeof s['command'] === 'string' && s['command'].trim() !== '';
        const hasUrl = typeof s['url'] === 'string' && s['url'].trim() !== '';
        if (!hasCommand && !hasUrl) {
          const loc = ctx.file.json?.locate(['mcpServers', name]);
          findings.push(makeFinding(this, ctx, `MCP server "${name}" has neither a "command" (stdio) nor a "url" (remote).`, loc));
        }
      }
      return findings;
    },
  },
  {
    id: 'mcp/invalid-transport',
    severity: 'warning',
    fixable: false,
    docsSlug: `${DOCS_BASE}/invalid-transport`,
    appliesTo: ['mcp'],
    meta: { title: 'MCP server has an invalid transport `type`', description: 'A remote server `type` must be "http" or "sse"; stdio servers omit `type`.' },
    check(ctx) {
      const root = rootObject(ctx);
      if (!root) return [];
      const servers = root['mcpServers'];
      if (servers === null || typeof servers !== 'object' || Array.isArray(servers)) return [];
      const findings: Finding[] = [];
      for (const [name, server] of Object.entries(servers as Record<string, unknown>)) {
        if (server === null || typeof server !== 'object' || Array.isArray(server)) continue;
        const s = server as Record<string, unknown>;
        const type = s['type'];
        if (type !== undefined && type !== 'http' && type !== 'sse') {
          const loc = ctx.file.json?.locate(['mcpServers', name, 'type']);
          findings.push(makeFinding(this, ctx, `MCP server "${name}" has invalid transport type ${JSON.stringify(type)}; expected "http" or "sse" (or omit for stdio).`, loc));
        }
      }
      return findings;
    },
  },
  {
    id: 'mcp/unknown-server-key',
    severity: 'info',
    fixable: false,
    docsSlug: `${DOCS_BASE}/unknown-server-key`,
    appliesTo: ['mcp'],
    meta: { title: 'Unknown key in MCP server entry', description: `Recognized keys: ${[...KNOWN_SERVER_KEYS].join(', ')}.` },
    check(ctx) {
      const root = rootObject(ctx);
      if (!root) return [];
      const servers = root['mcpServers'];
      if (servers === null || typeof servers !== 'object' || Array.isArray(servers)) return [];
      const findings: Finding[] = [];
      for (const [name, server] of Object.entries(servers as Record<string, unknown>)) {
        if (server === null || typeof server !== 'object' || Array.isArray(server)) continue;
        for (const key of Object.keys(server as Record<string, unknown>)) {
          if (!KNOWN_SERVER_KEYS.has(key)) {
            const loc = ctx.file.json?.locate(['mcpServers', name, key]);
            findings.push(makeFinding(this, ctx, `Unexpected key "${key}" in MCP server "${name}".`, loc));
          }
        }
      }
      return findings;
    },
  },
  {
    id: 'mcp/invalid-server-name',
    severity: 'warning',
    fixable: false,
    docsSlug: `${DOCS_BASE}/invalid-server-name`,
    appliesTo: ['mcp'],
    meta: {
      title: 'MCP server name has invalid characters',
      description: 'A server name becomes the `mcp__<name>__tool` prefix; it must be referenceable, so only letters, digits, `_` and `-` are safe.',
    },
    check(ctx) {
      const root = rootObject(ctx);
      if (!root) return [];
      const servers = root['mcpServers'];
      if (servers === null || typeof servers !== 'object' || Array.isArray(servers)) return [];
      const findings: Finding[] = [];
      for (const name of Object.keys(servers as Record<string, unknown>)) {
        // ReDoS-safe: single anchored bounded character-class repetition.
        if (!/^[A-Za-z0-9_-]+$/.test(name)) {
          const loc = ctx.file.json?.locate(['mcpServers', name]);
          findings.push(makeFinding(this, ctx, `MCP server name "${name}" has characters outside [A-Za-z0-9_-]; its tools are exposed as mcp__${name}__… which cannot be referenced in an agent tools/permissions entry.`, loc));
        }
      }
      return findings;
    },
  },
  {
    id: 'mcp/invalid-env-value',
    severity: 'warning',
    fixable: false,
    docsSlug: `${DOCS_BASE}/invalid-env-value`,
    appliesTo: ['mcp'],
    meta: {
      title: 'MCP env value is not a valid string',
      description: 'MCP `env` values must be strings; numbers/booleans/objects are invalid, and an empty value for a secret-named key is almost certainly a mistake.',
    },
    check(ctx) {
      const root = rootObject(ctx);
      if (!root) return [];
      const servers = root['mcpServers'];
      if (servers === null || typeof servers !== 'object' || Array.isArray(servers)) return [];
      const findings: Finding[] = [];
      for (const [name, server] of Object.entries(servers as Record<string, unknown>)) {
        if (server === null || typeof server !== 'object' || Array.isArray(server)) continue;
        const env = (server as Record<string, unknown>)['env'];
        if (env === null || typeof env !== 'object' || Array.isArray(env)) continue;
        for (const [k, v] of Object.entries(env as Record<string, unknown>)) {
          const loc = ctx.file.json?.locate(['mcpServers', name, 'env', k]);
          if (typeof v !== 'string') {
            const t = Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v;
            findings.push(makeFinding(this, ctx, `MCP env value for "${k}" in server "${name}" must be a string (got ${t}).`, loc));
          } else if (v.trim() === '' && isSecretKeyName(k)) {
            findings.push(makeFinding(this, ctx, `MCP env "${k}" in server "${name}" has an empty value; set it via a \${ENV_VAR} reference or remove it.`, loc));
          }
        }
      }
      return findings;
    },
  },
];
