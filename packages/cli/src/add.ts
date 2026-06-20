/**
 * `agentlint add <id>` — install a catalog item (Skill, MCP server, or Tool)
 * into the current project from the bundled catalog.
 *
 * Safety:
 *  - The item's content is re-validated with agentlint before anything is
 *    written; an item with lint errors is refused.
 *  - MCP servers are MERGED into an existing `.mcp.json` (never clobbered).
 *  - Existing target files are not overwritten without `--force`.
 *  - `--dry-run` prints what would happen and writes nothing.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { lintFiles, type FileKind } from 'agentlint-core';
import type { AddCommand } from './args.js';
import { CATALOG_ITEMS } from './catalog.generated.js';
// Type-only import (erased at runtime, so no import cycle with index.ts).
import type { Io } from './index.js';

type Item = (typeof CATALOG_ITEMS)[number];

const KIND_LABEL: Record<string, string> = { skill: 'skill', mcp: 'MCP server', tool: 'tool' };

/** Find a catalog item by exact id, then by exact name. */
function findItem(idOrName: string): Item | undefined {
  return CATALOG_ITEMS.find((i) => i.id === idOrName) ?? CATALOG_ITEMS.find((i) => i.name === idOrName);
}

/** Print the catalog grouped by kind. */
function listCatalog(io: Io): number {
  for (const kind of ['skill', 'mcp', 'tool'] as const) {
    const items = CATALOG_ITEMS.filter((i) => i.kind === kind);
    io.stdout(`\n${KIND_LABEL[kind]}s (${items.length}):\n`);
    for (const i of items) {
      io.stdout(`  ${i.id.padEnd(34)} ${i.description}\n`);
    }
  }
  io.stdout(`\nInstall one with: agentlint add <id>\n`);
  return 0;
}

/** Validate an item's content with agentlint; return error findings. */
function lintErrors(item: Item): string[] {
  const result = lintFiles([{ path: item.targetPath, content: item.content, kind: item.configKind as FileKind }]);
  return result.findings.filter((f) => f.severity === 'error').map((f) => `${f.ruleId}: ${f.message}`);
}

/** Merge an MCP server into the project `.mcp.json` (creating it if absent). */
async function addMcpServer(item: Item, cmd: AddCommand, io: Io): Promise<number> {
  const target = path.resolve(io.cwd(), '.mcp.json');
  let incoming: unknown;
  try {
    incoming = JSON.parse(item.content);
  } catch {
    io.stderr(`agentlint: catalog item "${item.id}" has invalid JSON content.\n`);
    return 2;
  }
  const servers = (incoming as { mcpServers?: Record<string, unknown> }).mcpServers ?? {};
  const name = Object.keys(servers)[0];
  if (!name) {
    io.stderr(`agentlint: catalog item "${item.id}" has no server definition.\n`);
    return 2;
  }

  // Read any existing .mcp.json and normalize its shape.
  let doc: { mcpServers: Record<string, unknown> } = { mcpServers: {} };
  try {
    const parsed = JSON.parse(await fs.readFile(target, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      doc = parsed as { mcpServers: Record<string, unknown> };
      if (!doc.mcpServers || typeof doc.mcpServers !== 'object' || Array.isArray(doc.mcpServers)) {
        doc.mcpServers = {};
      }
    }
  } catch {
    // No existing file (or unreadable): start fresh.
  }

  if (doc.mcpServers[name] !== undefined && !cmd.force) {
    io.stderr(`agentlint: MCP server "${name}" already exists in .mcp.json. Use --force to overwrite.\n`);
    return 2;
  }
  doc.mcpServers[name] = servers[name];

  if (cmd.dryRun) {
    io.stdout(`Would add MCP server "${name}" to .mcp.json (set the referenced env vars before use).\n`);
    return 0;
  }
  await fs.writeFile(target, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  io.stdout(`Added MCP server "${name}" → .mcp.json. Set the referenced \${ENV_VAR}s before use.\n`);
  return 0;
}

/** Write a single-file item (skill / agent / command). */
async function addFileItem(item: Item, cmd: AddCommand, io: Io): Promise<number> {
  const target = path.resolve(io.cwd(), item.targetPath);
  let exists = false;
  try {
    await fs.access(target);
    exists = true;
  } catch {
    // Does not exist: fine.
  }
  if (exists && !cmd.force) {
    io.stderr(`agentlint: ${item.targetPath} already exists. Use --force to overwrite.\n`);
    return 2;
  }
  if (cmd.dryRun) {
    io.stdout(`Would write ${KIND_LABEL[item.kind]} "${item.name}" → ${item.targetPath}\n`);
    return 0;
  }
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, item.content, 'utf8');
  io.stdout(`Added ${KIND_LABEL[item.kind]} "${item.name}" → ${item.targetPath}\n`);
  return 0;
}

/** Implements `agentlint add`. */
export async function runAdd(cmd: AddCommand, io: Io): Promise<number> {
  if (cmd.list) return listCatalog(io);

  const id = cmd.idOrName as string;
  const item = findItem(id);
  if (!item) {
    io.stderr(`agentlint: no catalog item "${id}". Run 'agentlint add --list' to see all ids.\n`);
    return 2;
  }

  // Defense in depth: never install content that does not pass agentlint.
  const errors = lintErrors(item);
  if (errors.length > 0) {
    io.stderr(`agentlint: refusing to add "${item.id}" — it has lint errors:\n`);
    for (const e of errors) io.stderr(`  ${e}\n`);
    return 2;
  }

  return item.configKind === 'mcp' ? addMcpServer(item, cmd, io) : addFileItem(item, cmd, io);
}
