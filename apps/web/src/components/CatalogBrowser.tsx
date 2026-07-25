'use client';

import { useMemo, useState } from 'react';
import type { CatalogItem, CatalogKind } from '@/lib/catalog';
import { BUNDLES, bundleInstallCommand, bundleItems, unbundledItems, type Bundle } from '@/lib/bundles';
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
    '# agentcheck catalog bundle',
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
    '1. Unzip into your project root: `unzip agentcheck-catalog.zip -d <your-project>`',
    '2. For MCP servers, set the referenced `${ENV_VAR}`s in your shell or `.env` before starting Claude Code.',
    '3. Restart Claude Code so it discovers the new skills / agents / commands / servers.',
    '4. Validate everything: `npx agentcheck`.',
    '',
    '## Security',
    '',
    'Every item was validated by **agentcheck** with zero errors: no hardcoded secrets, no',
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
  /** Selected bundle id, `'other'` for the unbundled leftovers, or null for everything. */
  const [bundleId, setBundleId] = useState<string | null>(null);

  const bundle = BUNDLES.find((b) => b.id === bundleId) ?? null;

  /** Items the current bundle selection allows (before kind/search filtering). */
  const scoped = useMemo(() => {
    if (bundle) return bundleItems(bundle, items);
    if (bundleId === 'other') return unbundledItems(items);
    return items;
  }, [items, bundle, bundleId]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.filter((i) => {
      if (filter !== 'all' && i.kind !== filter) return false;
      if (q === '') return true;
      const hay = `${i.name} ${i.title} ${i.description} ${i.tags.join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [scoped, filter, query]);

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
    entries.push({ path: 'AGENTCHECK-README.md', content: bundleReadme(visible) });
    downloadBytes('agentcheck-catalog.zip', makeZip(entries), 'application/zip');
  }

  const otherCount = useMemo(() => unbundledItems(items).length, [items]);

  // Tab counts follow the current bundle, so "All 13" can never sit above 13 results.
  const scopedCounts: Record<Filter, number> = useMemo(
    () =>
      bundleId === null
        ? counts
        : {
            all: scoped.length,
            skill: scoped.filter((i) => i.kind === 'skill').length,
            mcp: scoped.filter((i) => i.kind === 'mcp').length,
            tool: scoped.filter((i) => i.kind === 'tool').length,
          },
    [bundleId, counts, scoped],
  );

  return (
    <div>
      {/* Bundles — pick by what you're doing, not by file type. */}
      <section aria-labelledby="bundles-heading" className="mb-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="bundles-heading" className="text-lg font-semibold text-white">
            Start with a bundle
          </h2>
          {bundleId && (
            <button
              onClick={() => setBundleId(null)}
              className="text-xs text-zinc-400 underline-offset-2 hover:text-white hover:underline"
            >
              ← Back to all {counts.all} items
            </button>
          )}
        </div>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          Grouped by what you are doing, not by file type. Pick one to install a ready-made set —
          or browse everything below.
        </p>

        {!bundleId ? (
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {BUNDLES.map((b) => {
              const n = bundleItems(b, items).length;
              if (n === 0) return null;
              return (
                <button
                  key={b.id}
                  onClick={() => setBundleId(b.id)}
                  className="group rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-left transition hover:border-brand-fg/30 hover:bg-white/[0.06]"
                >
                  <div className="flex items-center gap-2">
                    <span aria-hidden className="text-base">
                      {b.icon}
                    </span>
                    <span className="font-medium text-white">{b.label}</span>
                    <span className="ml-auto shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-zinc-400">
                      {n}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{b.blurb}</p>
                </button>
              );
            })}
            {otherCount > 0 && (
              <button
                onClick={() => setBundleId('other')}
                className="rounded-xl border border-dashed border-white/10 bg-transparent p-3.5 text-left transition hover:border-white/20 hover:bg-white/[0.03]"
              >
                <div className="flex items-center gap-2">
                  <span aria-hidden className="text-base">
                    📦
                  </span>
                  <span className="font-medium text-zinc-200">Everything else</span>
                  <span className="ml-auto shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-zinc-400">
                    {otherCount}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                  Items that don&apos;t fit one purpose — browse them on their own.
                </p>
              </button>
            )}
          </div>
        ) : (
          <BundleDetail
            bundle={bundle}
            items={scoped}
            fallbackLabel={bundleId === 'other' ? 'Everything else' : undefined}
          />
        )}
      </section>

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
                {t.label} <span className={active ? 'text-brand-fg' : 'text-zinc-500'}>{scopedCounts[t.id]}</span>
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

/** The open bundle: what it's for, what's inside, and how to install all of it. */
function BundleDetail({
  bundle,
  items,
  fallbackLabel,
}: {
  bundle: Bundle | null;
  items: CatalogItem[];
  fallbackLabel?: string;
}) {
  const install = bundle ? bundleInstallCommand(bundle, items) : `npx agentcheck add ${items.map((i) => i.id).join(' ')}`;
  const n = (k: CatalogKind) => items.filter((i) => i.kind === k).length;

  return (
    <div className="mt-4 rounded-xl border border-brand-fg/20 bg-brand/[0.06] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span aria-hidden className="text-lg">
          {bundle?.icon ?? '📦'}
        </span>
        <h3 className="text-base font-semibold text-white">{bundle?.label ?? fallbackLabel}</h3>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-zinc-300">
          {items.length} items · {n('skill')} skills, {n('tool')} tools, {n('mcp')} MCP servers
        </span>
      </div>

      {bundle && <p className="mt-2 text-sm text-zinc-300">{bundle.useWhen}</p>}

      <p className="mt-3 text-xs font-medium text-zinc-300">Install the whole bundle:</p>
      <div className="mt-1.5 flex items-center gap-2 rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5">
        <code className="scroll-thin flex-1 overflow-x-auto whitespace-nowrap font-mono text-[11px] text-zinc-200">
          {install}
        </code>
        <CopyButton value={install} label="Copy cmd" />
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">
        Or use <span className="text-zinc-300">↓ Download .zip</span> below to get every file at once —
        it unzips straight into your project. MCP servers still need their{' '}
        <span className="text-amber-300/90">🔑 env vars</span> set, and Claude Code needs a restart
        before it sees new items.
      </p>
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
            title="Validated by agentcheck: no hardcoded secrets, no remote-code-execution patterns, no over-broad tool/permission grants."
            className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300"
          >
            ✓ agentcheck
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
