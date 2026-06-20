'use client';

import { useMemo, useState } from 'react';
import type { CatalogItem, CatalogKind } from '@/lib/catalog';
import { makeZip, type ZipEntry } from '@/lib/zip';
import { CopyButton } from './CopyButton';

type Filter = CatalogKind | 'all';

const KIND_LABEL: Record<CatalogKind, string> = {
  skill: 'Skill',
  mcp: 'MCP',
  tool: 'Tool',
};

const KIND_BADGE: Record<CatalogKind, string> = {
  skill: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  mcp: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  tool: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
};

const TABS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'skill', label: 'Skills' },
  { id: 'mcp', label: 'MCP servers' },
  { id: 'tool', label: 'Tools' },
];

/** Browser-side file download via a Blob (no network, nothing leaves the page). */
function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** A non-colliding, descriptive filename for a single item. */
function downloadName(item: CatalogItem): string {
  if (item.kind === 'mcp') return `${item.name}.mcp.json`;
  if (item.configKind === 'skill') return `${item.name}.SKILL.md`;
  return `${item.name}.md`;
}

/** Browser-side binary download via a Blob. */
function downloadBytes(filename: string, bytes: Uint8Array, mime: string): void {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** A usage + security README placed at the root of the downloaded bundle. */
function bundleReadme(items: CatalogItem[]): string {
  const n = (k: CatalogKind) => items.filter((i) => i.kind === k).length;
  return [
    '# agentlint catalog bundle',
    '',
    'Extract this archive at the ROOT of your project — every file lands where Claude Code expects it:',
    '',
    '- `.claude/skills/<name>/SKILL.md` — Agent Skills',
    '- `.claude/agents/<name>.md` — subagents',
    '- `.claude/commands/<name>.md` — slash commands',
    '- `.mcp.json` — MCP servers (all selected servers MERGED into one file)',
    '',
    '## How to use',
    '',
    '1. Unzip into your project root: `unzip agentlint-catalog.zip -d <your-project>`',
    '2. For MCP servers, set the referenced `${ENV_VAR}`s in your shell or `.env` before starting Claude Code.',
    '3. Restart Claude Code so it discovers the new skills / agents / commands / servers.',
    '4. Validate everything: `npx agentlint`.',
    '',
    '## Security',
    '',
    'Every item was validated by **agentlint** with zero errors: no hardcoded secrets, no',
    'remote-code-execution patterns, and no over-broad tool/permission grants. All credentials',
    'are `${ENV_VAR}` references — set them yourself; nothing secret is included here.',
    '',
    `## Included (${n('skill')} skills, ${n('tool')} tools, ${n('mcp')} MCP servers)`,
    '',
    ...items.map((i) => `- [${i.kind}] \`${i.name}\` → ${i.targetPath}`),
    '',
  ].join('\n');
}

/** How to install each kind, shown under the preview. */
function installHint(item: CatalogItem): string {
  switch (item.configKind) {
    case 'mcp':
      return 'Merge into your project .mcp.json (or run the install command below).';
    case 'skill':
      return `Save as ${item.targetPath}`;
    case 'agent':
      return `Save as ${item.targetPath} — invoke it via the Task tool / auto-delegation.`;
    case 'command':
      return `Save as ${item.targetPath} — run it as /${item.name}.`;
  }
}

export function CatalogBrowser({
  items,
  counts,
}: {
  items: CatalogItem[];
  counts: Record<Filter, number>;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (filter !== 'all' && i.kind !== filter) return false;
      if (q === '') return true;
      const hay = `${i.name} ${i.title} ${i.description} ${i.tags.join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, filter, query]);

  function downloadAll(): void {
    const entries: ZipEntry[] = [];
    const mcpServers: Record<string, unknown> = {};
    const seen = new Set<string>();
    for (const i of visible) {
      if (i.configKind === 'mcp') {
        // All selected MCP servers merge into ONE .mcp.json (usable as-is).
        try {
          const doc = JSON.parse(i.content) as { mcpServers?: Record<string, unknown> };
          for (const [k, v] of Object.entries(doc.mcpServers ?? {})) mcpServers[k] = v;
        } catch {
          /* skip malformed */
        }
      } else if (!seen.has(i.targetPath)) {
        // Skills / agents / commands land at their real project path.
        seen.add(i.targetPath);
        entries.push({ path: i.targetPath, content: i.content });
      }
    }
    if (Object.keys(mcpServers).length > 0) {
      entries.push({ path: '.mcp.json', content: JSON.stringify({ mcpServers }, null, 2) + '\n' });
    }
    entries.push({ path: 'AGENTLINT-README.md', content: bundleReadme(visible) });
    downloadBytes('agentlint-catalog.zip', makeZip(entries), 'application/zip');
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <label htmlFor="catalog-search" className="sr-only">
              Search the catalog
            </label>
            <input
              id="catalog-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search skills, MCP servers, tools…"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600"
            />
          </div>
          <button
            type="button"
            onClick={downloadAll}
            disabled={visible.length === 0}
            className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            ↓ Download .zip ({visible.length})
          </button>
        </div>

        {/* Kind tabs */}
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by kind">
          {TABS.map((t) => {
            const active = filter === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(t.id)}
                className={
                  active
                    ? 'rounded-full border border-brand-fg/40 bg-brand/20 px-3.5 py-1.5 text-sm font-medium text-white'
                    : 'rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white'
                }
              >
                {t.label} <span className={active ? 'text-brand-fg' : 'text-zinc-500'}>{counts[t.id]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Result count */}
      <p className="mt-5 text-xs text-zinc-500" aria-live="polite">
        {visible.length} {visible.length === 1 ? 'result' : 'results'}
        {query.trim() ? ` for “${query.trim()}”` : ''}
      </p>

      {/* Grid */}
      {visible.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-400">
          No matches. Try a different search or filter.
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => (
            <CatalogCard key={item.id} item={item} onTag={(t) => setQuery(t)} />
          ))}
        </div>
      )}
    </div>
  );
}

function CatalogCard({ item, onTag }: { item: CatalogItem; onTag: (tag: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${KIND_BADGE[item.kind]}`}
          >
            {KIND_LABEL[item.kind]}
          </span>
          <span
            title="Validated by agentlint: no hardcoded secrets, no remote-code-execution patterns, no over-broad tool/permission grants."
            className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300"
          >
            ✓ agentlint
          </span>
        </div>
        {item.license && (
          <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
            {item.license}
          </span>
        )}
      </div>

      <div>
        <h3 className="font-semibold leading-tight text-white">{item.title}</h3>
        <code className="mt-0.5 block font-mono text-xs text-brand-fg">{item.name}</code>
      </div>

      <p className="text-xs leading-relaxed text-zinc-400">{item.description}</p>

      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.tags.slice(0, 6).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onTag(tag)}
              className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
              title={`Filter by “${tag}”`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <code className="truncate font-mono text-[11px] text-zinc-500" title={item.targetPath}>
        {item.targetPath}
      </code>

      {item.envVars && item.envVars.length > 0 && (
        <p className="text-[11px] text-amber-300/80">
          🔑 Set before use: <span className="font-mono">{item.envVars.join(', ')}</span>
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <CopyButton value={item.content} />
        <button
          type="button"
          onClick={() => downloadFile(downloadName(item), item.content, item.kind === 'mcp' ? 'application/json' : 'text/markdown')}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white"
        >
          ↓ Download
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white"
        >
          {open ? 'Hide' : 'Preview'}
        </button>
        {item.source !== 'local' && (
          <a
            href={item.source}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto font-mono text-[11px] text-zinc-500 hover:text-brand-fg hover:underline"
          >
            source ↗
          </a>
        )}
      </div>

      {open && (
        <div className="mt-1 space-y-2">
          <p className="text-[11px] text-zinc-500">{installHint(item)}</p>
          {item.install && (
            <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5">
              <code className="scroll-thin flex-1 overflow-x-auto whitespace-nowrap font-mono text-[11px] text-zinc-200">
                {item.install}
              </code>
              <CopyButton value={item.install} label="Copy cmd" />
            </div>
          )}
          <pre className="scroll-thin max-h-72 overflow-auto rounded-md border border-white/10 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-zinc-200">
            <code>{item.content}</code>
          </pre>
        </div>
      )}
    </article>
  );
}
