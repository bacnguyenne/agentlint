/**
 * Repo directory ("Collections"): a curated, categorized directory of the
 * GitHub repositories behind the agent-skills / MCP / agent-tools ecosystem,
 * grouped into collections ("bộ") with synced star counts.
 *
 * DATA lives in `repo-directory.generated.ts`, produced by
 * `scripts/sync-stars.mjs` from `data/repo-directory.json` (run
 * `npm run sync:stars`). Star counts are refreshed at sync time and again
 * live in the browser (per-card, cached) on the /collections page.
 */
import { REPO_DIRECTORY_ITEMS, REPO_DIRECTORY_UPDATED } from './repo-directory.generated';

export type RepoKind = 'skills' | 'mcp' | 'tools' | 'lists';

export interface DirectoryRepo {
  fullName: string;
  url: string;
  description: string;
  stars: number;
  kind: RepoKind;
  collections: string[];
  topics: string[];
  note: string;
  archived?: boolean;
}

export const DIRECTORY: DirectoryRepo[] = REPO_DIRECTORY_ITEMS as unknown as DirectoryRepo[];
export const DIRECTORY_UPDATED: string | null = REPO_DIRECTORY_UPDATED;

/** Human labels + one-liners for every collection ("bộ"), in display order. */
export const COLLECTIONS: { id: string; label: string; blurb: string }[] = [
  { id: 'official-skills', label: 'Official skills', blurb: 'First-party skill repos from Anthropic, OpenAI, Google, Hugging Face & more' },
  { id: 'official-mcp', label: 'Official MCP', blurb: 'The MCP spec, official SDKs and vendor-official servers' },
  { id: 'skill-collections', label: 'Skill collections', blurb: 'Multi-skill libraries and packs from the community' },
  { id: 'single-skills', label: 'Single skills', blurb: 'One standout skill per repo' },
  { id: 'skill-platforms', label: 'Skill platforms', blurb: 'Frameworks, CLIs and products that ship or manage skills' },
  { id: 'mcp-servers', label: 'MCP servers', blurb: 'Individual MCP servers: browsers, databases, design tools, apps' },
  { id: 'mcp-frameworks', label: 'MCP frameworks', blurb: 'SDKs and frameworks for building MCP servers & clients' },
  { id: 'mcp-infra', label: 'MCP infrastructure', blurb: 'Gateways, context optimizers and security scanners' },
  { id: 'agent-tools', label: 'Agent tools', blurb: 'Capabilities for agents: browser use, sandboxes, memory, toolkits' },
  { id: 'office-suite', label: 'Office', blurb: 'Word, Excel, PowerPoint, Gmail, Drive, Lark — office work for agents' },
  { id: 'writing-content', label: 'Writing', blurb: 'Writing, humanizing and content-creation skills' },
  { id: 'marketing-seo', label: 'Marketing & SEO', blurb: 'CRO, SEO, ads and social-content skills' },
  { id: 'business-pm', label: 'Business & PM', blurb: 'Product management, job search and business operations' },
  { id: 'research-academic', label: 'Research', blurb: 'Academic research, paper writing and science skills' },
  { id: 'creative-media', label: 'Creative & media', blurb: 'Design, slides, video and image production' },
  { id: 'life-personal', label: 'Life & personal', blurb: 'Notes, PKM and personal automation' },
  { id: 'awesome-skills', label: 'Awesome lists — skills', blurb: 'Curated lists of skills' },
  { id: 'awesome-mcp', label: 'Awesome lists — MCP', blurb: 'Curated lists of MCP servers' },
];

export const KIND_LABELS: Record<RepoKind, string> = {
  skills: 'Skills',
  mcp: 'MCP',
  tools: 'Tools',
  lists: 'Lists',
};

export const TOPIC_LABELS: Record<string, string> = {
  coding: 'Coding',
  office: 'Office',
  writing: 'Writing',
  marketing: 'Marketing',
  business: 'Business',
  research: 'Research',
  creative: 'Creative',
  life: 'Life',
  general: 'General',
  data: 'Data',
};

/** "106742" -> "106.7k" (GitHub-style compact stars). */
export function formatStars(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

/** Counts per kind for the UI tabs. */
export const DIRECTORY_COUNTS: Record<RepoKind | 'all', number> = {
  all: DIRECTORY.length,
  skills: DIRECTORY.filter((r) => r.kind === 'skills').length,
  mcp: DIRECTORY.filter((r) => r.kind === 'mcp').length,
  tools: DIRECTORY.filter((r) => r.kind === 'tools').length,
  lists: DIRECTORY.filter((r) => r.kind === 'lists').length,
};
