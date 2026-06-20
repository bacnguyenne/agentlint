#!/usr/bin/env node
/**
 * agentlint MCP server — stdio, newline-delimited JSON-RPC 2.0.
 *
 * Exposes agentlint as MCP tools so an agent (e.g. Claude Code) can lint its OWN
 * configuration. Dependency-free: speaks the MCP stdio protocol directly rather
 * than pulling an SDK, matching agentlint's zero-runtime-dep ethos. Like the rest
 * of agentlint it only PARSES content — it never executes, imports, or fetches.
 *
 * Configure in `.mcp.json`:
 *   { "mcpServers": { "agentlint": { "command": "npx", "args": ["-y", "agentlint-mcp"] } } }
 */
import * as readline from 'node:readline';
import { pathToFileURL } from 'node:url';
import {
  lintFiles,
  lintDirectory,
  rules,
  type FileKind,
  type LintResult,
} from 'agentlint-core';

const PROTOCOL_VERSION = '2024-11-05';

/** Canonical filename per kind, so a pasted snippet classifies correctly. */
const KIND_PATH: Record<string, string> = {
  claudemd: 'CLAUDE.md',
  agent: '.claude/agents/agent.md',
  command: '.claude/commands/command.md',
  skill: '.claude/skills/my-skill/SKILL.md',
  settings: '.claude/settings.json',
  mcp: '.mcp.json',
  instructions: 'AGENTS.md',
};

function summarize(r: LintResult): string {
  const s = r.summary;
  const head = `${s.errors} error(s), ${s.warnings} warning(s), ${s.infos} info(s) across ${s.filesChecked} file(s).`;
  const lines = r.findings.map(
    (f) => `${f.file}:${f.line ?? '-'}:${f.column ?? '-'}  ${f.severity}  ${f.ruleId}  ${f.message}`,
  );
  return r.findings.length ? `${head}\n\n${lines.join('\n')}` : `${head}\n\nNo problems found.`;
}

const TOOLS = [
  {
    name: 'lint_config',
    description:
      'Lint a single AI coding-agent config passed as text (Claude Code, MCP, Cursor, Copilot, AGENTS.md, Windsurf, Cline). Returns findings with rule ids, line:col, and severities. Pure — never executes the content.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The config file contents to lint.' },
        kind: {
          type: 'string',
          enum: Object.keys(KIND_PATH),
          description: 'File kind. Omit to treat the content as CLAUDE.md.',
        },
      },
      required: ['content'],
    },
  },
  {
    name: 'lint_directory',
    description: 'Lint every agent-config file under a directory on disk (reads files; never executes them).',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Directory to lint (default ".").' } },
    },
  },
  {
    name: 'list_rules',
    description: 'List all agentlint rules (id, severity, fixable, title).',
    inputSchema: { type: 'object', properties: {} },
  },
];

function send(msg: unknown): void {
  process.stdout.write(`${JSON.stringify(msg)}\n`);
}
function ok(id: unknown, value: unknown): void {
  send({ jsonrpc: '2.0', id, result: value });
}
function fail(id: unknown, code: number, message: string): void {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}
function toolText(id: unknown, text: string, isError = false): void {
  ok(id, { content: [{ type: 'text', text }], isError });
}

interface JsonRpc {
  id?: unknown;
  method?: string;
  params?: { name?: string; arguments?: Record<string, unknown> };
}

async function handle(req: JsonRpc): Promise<void> {
  const { id, method, params } = req;
  switch (method) {
    case 'initialize':
      ok(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'agentlint', version: '1.0.0' },
      });
      return;
    case 'notifications/initialized':
    case 'initialized':
      return; // notification — no response
    case 'ping':
      ok(id, {});
      return;
    case 'tools/list':
      ok(id, { tools: TOOLS });
      return;
    case 'tools/call': {
      const name = params?.name;
      const args = params?.arguments ?? {};
      try {
        if (name === 'lint_config') {
          const content = String(args['content'] ?? '');
          const kind = typeof args['kind'] === 'string' ? (args['kind'] as FileKind) : undefined;
          const path = kind ? KIND_PATH[kind] ?? 'CLAUDE.md' : 'CLAUDE.md';
          const r = lintFiles([kind ? { path, content, kind } : { path, content }]);
          toolText(id, summarize(r), r.summary.errors > 0);
          return;
        }
        if (name === 'lint_directory') {
          const r = await lintDirectory(String(args['path'] ?? '.'));
          toolText(id, summarize(r), r.summary.errors > 0);
          return;
        }
        if (name === 'list_rules') {
          const text = rules
            .map((r) => `${r.id}\t${r.severity}${r.fixable ? '\t(fixable)' : ''}\t${r.meta.title}`)
            .join('\n');
          toolText(id, `${rules.length} rules:\n${text}`);
          return;
        }
        fail(id, -32602, `Unknown tool: ${String(name)}`);
      } catch (e) {
        toolText(id, `agentlint error: ${e instanceof Error ? e.message : String(e)}`, true);
      }
      return;
    }
    default:
      if (id !== undefined) fail(id, -32601, `Method not found: ${String(method)}`);
  }
}

/**
 * Start the MCP stdio server: read newline-delimited JSON-RPC from stdin and
 * dispatch each request. Used by BOTH the standalone `agentlint-mcp` bin and the
 * `agentlint mcp` subcommand. Runs until stdin closes.
 */
export function startMcpServer(): void {
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let req: JsonRpc;
    try {
      req = JSON.parse(trimmed) as JsonRpc;
    } catch {
      return; // ignore non-JSON lines
    }
    void handle(req);
  });
}

// Auto-start ONLY when run directly as the `agentlint-mcp` bin — not when the
// main CLI imports this module for the `agentlint mcp` subcommand.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startMcpServer();
}
