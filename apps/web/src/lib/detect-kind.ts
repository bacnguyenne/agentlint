/**
 * Heuristics to auto-detect which kind of agent-config file some pasted text
 * is, so the validator can pre-select the right file kind (the user can always
 * override). Pure and side-effect free; unit-tested in detect-kind.test.ts.
 *
 * Strategy:
 *  1. If a path is known, defer to core's path classifier (authoritative).
 *  2. Otherwise inspect the content shape (JSON vs frontmatter vs markdown)
 *     and look for distinctive keys.
 */
import type { FileKind } from 'agentlint-core';

/**
 * Local, pure copy of core's path classifier.
 *
 * We deliberately do NOT import `classifyPath` from `agentlint-core` here:
 * that would pull core's index, which re-exports the filesystem-touching
 * `discover` module (`node:fs`/`node:path`) into the CLIENT bundle. This helper
 * runs in the browser, so it must stay free of Node built-ins. The logic mirrors
 * core's `classifyPath` exactly (SPEC §1 discovery rules).
 */
export function classifyPath(filePath: string): FileKind {
  const norm = filePath.replace(/\\/g, '/');
  const base = norm.split('/').pop() ?? norm;

  if (base === '.mcp.json') return 'mcp';
  if (base === 'settings.json' || base === 'settings.local.json') {
    return norm.includes('.claude/') ? 'settings' : 'unknown';
  }
  if (base === 'CLAUDE.md') return 'claudemd';
  if (norm.includes('.claude/agents/') && base.endsWith('.md')) return 'agent';
  if (norm.includes('.claude/commands/') && base.endsWith('.md')) return 'command';
  // Agent Skills: `.claude/skills/<name>/SKILL.md` (any case-variant of skill.md).
  if (norm.includes('.claude/skills/') && /^skill\.md$/i.test(base)) return 'skill';

  // Cross-tool agent instruction files (mirror of core's classifyPath).
  if (base === 'AGENTS.md') return 'instructions';
  if (base === '.cursorrules' || base === '.windsurfrules' || base === '.clinerules') return 'instructions';
  if (norm.includes('.cursor/rules/') && base.endsWith('.mdc')) return 'instructions';
  if (norm.includes('.github/') && base === 'copilot-instructions.md') return 'instructions';

  return 'unknown';
}

/** Kinds the web UI lets the user pick (excludes the catch-all 'unknown'). */
export const SELECTABLE_KINDS = [
  'claudemd',
  'agent',
  'command',
  'skill',
  'settings',
  'mcp',
  'instructions',
] as const satisfies readonly FileKind[];

export type SelectableKind = (typeof SELECTABLE_KINDS)[number];

/** Human-friendly labels and the canonical filename for each kind. */
export const KIND_META: Record<
  SelectableKind,
  { label: string; filename: string; hint: string }
> = {
  claudemd: { label: 'CLAUDE.md', filename: 'CLAUDE.md', hint: 'Project memory / instructions' },
  agent: { label: 'Subagent', filename: '.claude/agents/agent.md', hint: 'A custom subagent' },
  command: {
    label: 'Slash command',
    filename: '.claude/commands/command.md',
    hint: 'A custom slash command',
  },
  skill: {
    label: 'Skill (SKILL.md)',
    filename: '.claude/skills/my-skill/SKILL.md',
    hint: 'A Claude Code Agent Skill',
  },
  settings: {
    label: 'settings.json',
    filename: '.claude/settings.json',
    hint: 'Claude Code settings & hooks',
  },
  mcp: { label: '.mcp.json', filename: '.mcp.json', hint: 'MCP server definitions' },
  instructions: {
    label: 'Instructions (Cursor/Copilot/AGENTS.md)',
    filename: 'AGENTS.md',
    hint: 'Cross-tool agent instruction files: AGENTS.md, .cursorrules, Copilot, Windsurf, Cline',
  },
};

/** The canonical path for a chosen kind, used when the user pastes raw text. */
export function pathForKind(kind: SelectableKind): string {
  return KIND_META[kind].filename;
}

function looksLikeJson(text: string): boolean {
  const t = text.trimStart();
  return t.startsWith('{') || t.startsWith('[');
}

/** Best-effort JSON parse; returns undefined on any error. Never throws. */
function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function hasFrontmatter(text: string): boolean {
  // A leading `---` line followed (anywhere later) by a closing `---` line.
  const t = text.replace(/^﻿/, '');
  if (!/^---[ \t]*\r?\n/.test(t)) return false;
  return /\r?\n---[ \t]*(\r?\n|$)/.test(t.slice(3));
}

/**
 * Detect the file kind from a path and/or content.
 *
 * @param content Pasted file content.
 * @param path    Optional filename/path the user supplied (e.g. from upload).
 * @returns A {@link SelectableKind} best guess (defaults to `claudemd`).
 */
export function detectKind(content: string, path?: string): SelectableKind {
  // 1) Trust an explicit, recognizable path first.
  if (path) {
    const byPath = classifyPath(path);
    if (byPath !== 'unknown') return byPath as SelectableKind;
  }

  const text = content ?? '';

  // 2) JSON-shaped content → settings vs mcp by distinctive keys.
  if (looksLikeJson(text)) {
    const parsed = tryParseJson(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      if ('mcpServers' in obj) return 'mcp';
      if (
        'hooks' in obj ||
        'permissions' in obj ||
        'statusLine' in obj ||
        'outputStyle' in obj ||
        'enableAllProjectMcpServers' in obj ||
        'includeCoAuthoredBy' in obj
      ) {
        return 'settings';
      }
    }
    // Unparseable or generic JSON: lean toward settings (it's strict JSON too),
    // but if the raw text mentions mcpServers, prefer mcp.
    if (/"mcpServers"\s*:/.test(text)) return 'mcp';
    return 'settings';
  }

  // 3) Markdown with YAML frontmatter → agent vs command.
  if (hasFrontmatter(text)) {
    // Command-only frontmatter keys are a strong signal.
    if (
      /^\s*(argument-hint|allowed-tools|disable-model-invocation)\s*:/m.test(text)
    ) {
      return 'command';
    }
    // `name:` + `description:` is the subagent contract.
    if (/^\s*name\s*:/m.test(text) && /^\s*description\s*:/m.test(text)) {
      return 'agent';
    }
    // Frontmatter present but ambiguous: treat as command (looser schema).
    return 'command';
  }

  // 4) Plain markdown with no frontmatter → CLAUDE.md.
  return 'claudemd';
}
