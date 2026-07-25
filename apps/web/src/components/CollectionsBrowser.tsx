'use client';

/**
 * Collections browser — the /collections page UI.
 *
 * Renders the curated repo directory (skills / MCP / tools / awesome lists)
 * with search, kind tabs, collection & topic filters, and star-sorted cards.
 * Star counts start from the build-time snapshot and upgrade to LIVE numbers
 * per card: we fetch the repo from the GitHub REST API (unauthenticated,
 * 60 req/h) with a 6-hour localStorage cache and a small concurrency queue;
 * on rate-limit we stop quietly and keep the snapshot numbers.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  COLLECTIONS,
  DIRECTORY_COUNTS,
  KIND_LABELS,
  TOPIC_LABELS,
  formatStars,
  type DirectoryRepo,
  type RepoKind,
} from '@/lib/repo-directory';

type KindFilter = RepoKind | 'all';
type SortKey = 'stars' | 'name';

const KIND_BADGE: Record<RepoKind, string> = {
  skills: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  mcp: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  tools: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  lists: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
};

const TABS: { id: KindFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'skills', label: 'Skills' },
  { id: 'mcp', label: 'MCP' },
  { id: 'tools', label: 'Tools' },
  { id: 'lists', label: 'Awesome lists' },
];

/* ------------------------- live star fetching ------------------------- */

const STAR_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const MAX_CONCURRENT = 3;
// Unauthenticated GitHub allows 60 requests/hour per IP. Only cards the visitor
// actually scrolls to are fetched, and never more than this many per page view —
// so a long scroll degrades to the synced snapshot instead of a wall of 403s.
const MAX_LIVE_PER_VIEW = 40;

let inflight = 0;
let spent = 0;
let blocked = false; // set on 403/429 — stop hitting the API for this page view
const queue: (() => void)[] = [];
const listeners = new Map<string, ((stars: number) => void)[]>();
const fetched = new Set<string>();

function cacheGet(fullName: string): number | null {
  try {
    const raw = localStorage.getItem(`al-stars:${fullName}`);
    if (!raw) return null;
    const { s, t } = JSON.parse(raw) as { s: number; t: number };
    return Date.now() - t < STAR_TTL_MS ? s : null;
  } catch {
    return null;
  }
}

function cacheSet(fullName: string, stars: number): void {
  try {
    localStorage.setItem(`al-stars:${fullName}`, JSON.stringify({ s: stars, t: Date.now() }));
  } catch {
    /* storage full/blocked — live numbers just won't persist */
  }
}

function pump(): void {
  while (!blocked && inflight < MAX_CONCURRENT && queue.length > 0) queue.shift()!();
}

/** Ask for a live star count; `cb` fires (possibly synchronously) when known. */
function requestStars(fullName: string, cb: (stars: number) => void): void {
  const cached = cacheGet(fullName);
  if (cached !== null) {
    cb(cached);
    return;
  }
  if (blocked || spent >= MAX_LIVE_PER_VIEW || fetched.has(fullName)) return;
  const cbs = listeners.get(fullName);
  if (cbs) {
    cbs.push(cb);
    return;
  }
  listeners.set(fullName, [cb]);
  queue.push(() => {
    inflight++;
    spent++;
    fetched.add(fullName);
    fetch(`https://api.github.com/repos/${fullName}`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then((res) => {
        if (res.status === 403 || res.status === 429) {
          blocked = true; // rate-limited: keep snapshots, stop asking
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then((data: { stargazers_count?: number } | null) => {
        const stars = data?.stargazers_count;
        if (typeof stars === 'number') {
          cacheSet(fullName, stars);
          for (const fn of listeners.get(fullName) ?? []) fn(stars);
        }
      })
      .catch(() => {
        /* offline — snapshot stays */
      })
      .finally(() => {
        listeners.delete(fullName);
        inflight--;
        pump();
      });
  });
  pump();
}

/**
 * Snapshot stars that upgrade to live once the card is ON SCREEN and the
 * GitHub API answers. Gating on visibility keeps a 138-card page well inside
 * the unauthenticated rate limit — you only spend requests on what you read.
 */
function useLiveStars(
  fullName: string,
  snapshot: number,
): { stars: number; live: boolean; ref: (node: HTMLElement | null) => void } {
  const [state, setState] = useState({ stars: snapshot, live: false });
  const asked = useRef(false);
  const observer = useRef<IntersectionObserver | null>(null);

  const ref = (node: HTMLElement | null) => {
    if (asked.current || !node) return;
    if (typeof IntersectionObserver === 'undefined') {
      asked.current = true;
      requestStars(fullName, (stars) => setState({ stars, live: true }));
      return;
    }
    observer.current?.disconnect();
    observer.current = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || asked.current) return;
        asked.current = true;
        observer.current?.disconnect();
        requestStars(fullName, (stars) => setState({ stars, live: true }));
      },
      { rootMargin: '200px' },
    );
    observer.current.observe(node);
  };

  useEffect(() => () => observer.current?.disconnect(), []);
  return { ...state, ref };
}

/* ------------------------------- browser ------------------------------- */

export function CollectionsBrowser({ items }: { items: DirectoryRepo[] }) {
  const [kind, setKind] = useState<KindFilter>('all');
  const [collection, setCollection] = useState<string>('all');
  const [topic, setTopic] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('stars');

  const collectionCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of items) for (const c of r.collections) m.set(c, (m.get(c) ?? 0) + 1);
    return m;
  }, [items]);

  const topicCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of items) for (const t of r.topics) m.set(t, (m.get(t) ?? 0) + 1);
    return m;
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = items.filter((r) => {
      if (kind !== 'all' && r.kind !== kind) return false;
      if (collection !== 'all' && !r.collections.includes(collection)) return false;
      if (topic !== 'all' && !r.topics.includes(topic)) return false;
      if (q === '') return true;
      const hay = `${r.fullName} ${r.description} ${r.note} ${r.collections.join(' ')} ${r.topics.join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
    out.sort((a, b) => (sort === 'stars' ? b.stars - a.stars : a.fullName.localeCompare(b.fullName)));
    return out;
  }, [items, kind, collection, topic, query, sort]);

  const activeCollection = COLLECTIONS.find((c) => c.id === collection);
  const hasFilters = kind !== 'all' || collection !== 'all' || topic !== 'all' || query.trim() !== '';

  return (
    <div>
      {/* Search + sort */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <label htmlFor="collections-search" className="sr-only">
            Search the directory
          </label>
          <input
            id="collections-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${items.length} repos — try “browser”, “office”, “SEO”, “memory”…`}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-sm text-zinc-200"
          >
            <option value="stars">Most stars</option>
            <option value="name">Name A→Z</option>
          </select>
        </label>
      </div>

      {/* Kind tabs */}
      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter by kind">
        {TABS.map((t) => {
          const active = kind === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setKind(active ? 'all' : t.id)}
              className={
                active
                  ? 'rounded-full border border-brand-fg/40 bg-brand/20 px-3.5 py-1.5 text-sm font-medium text-white'
                  : 'rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white'
              }
            >
              {t.label}{' '}
              <span className={active ? 'text-brand-fg' : 'text-zinc-500'}>{DIRECTORY_COUNTS[t.id]}</span>
            </button>
          );
        })}
      </div>

      {/* Collection chips */}
      <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Filter by collection">
        {COLLECTIONS.filter((c) => (collectionCounts.get(c.id) ?? 0) > 0).map((c) => {
          const active = collection === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setCollection(active ? 'all' : c.id)}
              title={c.blurb}
              className={
                active
                  ? 'rounded-md border border-brand-fg/40 bg-brand/20 px-2.5 py-1 text-xs font-medium text-white'
                  : 'rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200'
              }
            >
              {c.label} <span className={active ? 'text-brand-fg' : 'text-zinc-600'}>{collectionCounts.get(c.id)}</span>
            </button>
          );
        })}
      </div>

      {/* Topic chips */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Filter by topic">
        <span className="text-[11px] uppercase tracking-wide text-zinc-600">Topic</span>
        {Object.entries(TOPIC_LABELS)
          .filter(([id]) => (topicCounts.get(id) ?? 0) > 0)
          .map(([id, label]) => {
            const active = topic === id;
            return (
              <button
                key={id}
                onClick={() => setTopic(active ? 'all' : id)}
                className={
                  active
                    ? 'rounded-full bg-brand/30 px-2.5 py-0.5 text-xs font-medium text-white'
                    : 'rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200'
                }
              >
                {label} <span className={active ? 'text-brand-fg' : 'text-zinc-600'}>{topicCounts.get(id)}</span>
              </button>
            );
          })}
      </div>

      {/* Active collection blurb + result count */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-500" aria-live="polite">
          {visible.length} {visible.length === 1 ? 'repo' : 'repos'}
          {activeCollection ? (
            <>
              {' · '}
              <span className="text-zinc-300">{activeCollection.label}</span> — {activeCollection.blurb}
            </>
          ) : null}
          {query.trim() ? ` · “${query.trim()}”` : ''}
        </p>
        {hasFilters && (
          <button
            onClick={() => {
              setKind('all');
              setCollection('all');
              setTopic('all');
              setQuery('');
            }}
            className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-400">
          No matches. Try a different search or filter.
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((r) => (
            <RepoCard key={r.fullName} repo={r} onCollection={setCollection} />
          ))}
        </div>
      )}
    </div>
  );
}

function RepoCard({
  repo,
  onCollection,
}: {
  repo: DirectoryRepo;
  onCollection: (id: string) => void;
}) {
  const { stars, live, ref } = useLiveStars(repo.fullName, repo.stars);
  const [owner, name] = repo.fullName.split('/');

  return (
    <article
      ref={ref}
      className="flex flex-col gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20 hover:bg-white/[0.05]"
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${KIND_BADGE[repo.kind]}`}
        >
          {KIND_LABELS[repo.kind]}
        </span>
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 font-mono text-[11px] font-medium text-amber-200"
          title={live ? 'Live star count (GitHub API)' : 'Star count from the last sync'}
        >
          ★ {formatStars(stars)}
          {live && <span aria-hidden className="h-1 w-1 rounded-full bg-emerald-400" />}
          <span className="sr-only">{live ? ' (live)' : ' (synced)'}</span>
        </span>
      </div>

      <div>
        <h3 className="font-semibold leading-tight text-white">
          <a href={repo.url} target="_blank" rel="noopener noreferrer" className="hover:text-brand-fg hover:underline">
            {name}
          </a>
        </h3>
        <span className="mt-0.5 block font-mono text-xs text-zinc-500">{owner}</span>
      </div>

      <p className="line-clamp-3 text-xs leading-relaxed text-zinc-400" title={repo.description}>
        {repo.description || repo.note}
      </p>

      <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
        {repo.collections.map((c) => {
          const meta = COLLECTIONS.find((x) => x.id === c);
          return (
            <button
              key={c}
              onClick={() => onCollection(c)}
              title={meta?.blurb ?? c}
              className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
            >
              {meta?.label ?? c}
            </button>
          );
        })}
        <a
          href={repo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto font-mono text-[11px] text-zinc-500 hover:text-brand-fg hover:underline"
        >
          GitHub ↗
        </a>
      </div>
    </article>
  );
}
