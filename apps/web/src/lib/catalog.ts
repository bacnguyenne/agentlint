/**
 * Unified discovery catalog: Agent **Skills**, **MCP servers**, and **Tools**
 * (subagents & slash commands) for Claude Code, in one searchable list.
 *
 * The DATA lives in `catalog.generated.ts`, produced by `scripts/gen-catalog.mjs`
 * (run `npm run gen:catalog`). The same generated module is emitted into the CLI
 * (`packages/cli/src/catalog.generated.ts`) so the web `/catalog` page and the
 * `agentlint add` command share a single source of truth.
 *
 * EVERY item is validated by agentlint (zero errors) in `catalog.test.ts`, so
 * what users copy/download/install is known-good. Secrets are always
 * `${ENV_VAR}` references, never literals.
 */
import { CATALOG_ITEMS } from './catalog.generated';

/** Top-level UI category. */
export type CatalogKind = 'skill' | 'mcp' | 'tool';
/** How agentlint validates the item's `content`. */
export type ConfigKind = 'skill' | 'mcp' | 'agent' | 'command';

export interface CatalogItem {
  id: string;
  kind: CatalogKind;
  configKind: ConfigKind;
  /** Machine name (skill/agent/command name, or MCP server key). */
  name: string;
  /** Human-friendly title for the card. */
  title: string;
  description: string;
  /** Upstream URL, or 'local' for hand-curated/bundled items. */
  source: string;
  license?: string;
  /** Free-text tags powering search/filter. */
  tags: string[];
  /** Where the file belongs in a project (shown + used to name the download). */
  targetPath: string;
  /** The file contents (a SKILL.md, a `.mcp.json`, or an agent/command `.md`). */
  content: string;
  /** Optional one-line install command (e.g. `claude mcp add …` for MCP). */
  install?: string;
  /** For MCP: the `${ENV_VAR}` names a user must set before use. */
  envVars?: string[];
}

/** The full, unified catalog (generated). */
export const CATALOG: CatalogItem[] = CATALOG_ITEMS as unknown as CatalogItem[];

export const MCP_CATALOG: CatalogItem[] = CATALOG.filter((i) => i.kind === 'mcp');
export const TOOL_CATALOG: CatalogItem[] = CATALOG.filter((i) => i.kind === 'tool');

/** Counts per kind, for the UI. */
export const CATALOG_COUNTS: Record<CatalogKind | 'all', number> = {
  all: CATALOG.length,
  skill: CATALOG.filter((i) => i.kind === 'skill').length,
  mcp: CATALOG.filter((i) => i.kind === 'mcp').length,
  tool: CATALOG.filter((i) => i.kind === 'tool').length,
};
