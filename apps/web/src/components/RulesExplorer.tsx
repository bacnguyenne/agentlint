'use client';

import { useMemo, useState } from 'react';
import type { Severity } from 'agentlint-core';
import { SEVERITY_STYLES } from './severity';
import type { RuleContent } from '@/lib/rules-content';

export interface RuleEntry {
  id: string;
  severity: Severity;
  fixable: boolean;
  title: string;
  description: string;
  appliesTo: string[];
  group: 'security' | 'correctness';
  content?: RuleContent;
}

const GROUPS: { key: 'security' | 'correctness'; title: string; blurb: string }[] = [
  {
    key: 'security',
    title: 'Security',
    blurb: 'Secrets, dangerous commands, remote code execution, broad permissions, unsafe MCP transport.',
  },
  {
    key: 'correctness',
    title: 'Correctness & shape',
    blurb: 'The strict JSON/YAML shapes that silently break your agent when they are slightly wrong.',
  },
];

export function RulesExplorer({ entries }: { entries: RuleEntry[] }) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<'all' | 'security' | 'correctness'>('all');
  const [fixableOnly, setFixableOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (group !== 'all' && e.group !== group) return false;
      if (fixableOnly && !e.fixable) return false;
      if (!q) return true;
      return (
        e.id.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        (e.content?.whyItMatters.toLowerCase().includes(q) ?? false)
      );
    });
  }, [entries, query, group, fixableOnly]);

  const counts = useMemo(
    () => ({
      security: entries.filter((e) => e.group === 'security').length,
      correctness: entries.filter((e) => e.group === 'correctness').length,
      fixable: entries.filter((e) => e.fixable).length,
    }),
    [entries],
  );

  return (
    <div>
      {/* Reframe banner: these are CHECKS, not errors in your file. */}
      <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
        These are the <strong className="text-white">{entries.length} checks</strong> agentlint runs on your
        config. The colored tag on each is that check&apos;s <em>severity</em> — not an error in your file. Click any
        check to see a real <span className="text-rose-300">bad</span> →{' '}
        <span className="text-emerald-300">good</span> example and try it live.
      </div>

      {/* Controls */}
      <div className="sticky top-16 z-10 -mx-4 mb-6 flex flex-wrap items-center gap-2 bg-ink/80 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:border-white/10 sm:px-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search checks…"
          className="min-w-[12rem] flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600"
        />
        <div className="flex items-center gap-1.5">
          {(['all', 'security', 'correctness'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroup(g)}
              className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition ${
                group === g
                  ? 'border-brand/50 bg-brand/20 text-white'
                  : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
              }`}
            >
              {g === 'all' ? `All (${entries.length})` : `${g} (${counts[g]})`}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={fixableOnly}
            onChange={(e) => setFixableOnly(e.target.checked)}
            className="accent-brand"
          />
          Auto-fixable ({counts.fixable})
        </label>
      </div>

      <p className="mb-4 text-xs text-zinc-500">
        Showing {filtered.length} of {entries.length} checks.
      </p>

      <div className="space-y-10">
        {GROUPS.filter((g) => group === 'all' || group === g.key).map((g) => {
          const list = filtered.filter((e) => e.group === g.key);
          if (list.length === 0) return null;
          return (
            <section key={g.key} id={`cat-${g.key}`} className="scroll-mt-32">
              <h2 className="text-xl font-semibold text-white">{g.title}</h2>
              <p className="mt-1 text-sm text-zinc-500">{g.blurb}</p>
              <ul className="mt-4 space-y-3">
                {list.map((e) => (
                  <RuleCard key={e.id} entry={e} />
                ))}
              </ul>
            </section>
          );
        })}
        {filtered.length === 0 && (
          <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
            No checks match “{query}”.
          </p>
        )}
      </div>
    </div>
  );
}

function RuleCard({ entry }: { entry: RuleEntry }) {
  const [open, setOpen] = useState(false);
  const s = SEVERITY_STYLES[entry.severity];
  const c = entry.content;
  const canExpand = Boolean(c && (c.demoable || c.whyItMatters));

  return (
    <li id={entry.id} className="scroll-mt-32 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        onClick={() => canExpand && setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left"
      >
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${s.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
          {s.label}
        </span>
        {entry.fixable && (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
            auto-fixable
          </span>
        )}
        <code className="font-mono text-xs text-brand-fg">{entry.id}</code>
        <span className="text-sm font-medium text-zinc-100">{entry.title}</span>
        {canExpand && (
          <span className="ml-auto text-zinc-500" aria-hidden>
            {open ? '−' : '+'}
          </span>
        )}
      </button>

      {open && c && (
        <div className="space-y-4 border-t border-white/10 px-4 py-4">
          {c.whyItMatters && (
            <p className="text-sm leading-relaxed text-zinc-300">
              <span className="font-semibold text-white">Why it matters: </span>
              {c.whyItMatters}
            </p>
          )}

          {c.demoable && c.bad && c.good && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Example label="Flagged" tone="bad" content={c.bad.content} />
              <Example label="Passes" tone="good" content={c.good.content} />
            </div>
          )}

          {c.tip && (
            <p className="text-sm text-zinc-400">
              <span className="font-semibold text-zinc-200">Fix: </span>
              {c.tip}
            </p>
          )}

          {c.demoable && c.bad && (
            <a
              href={`/?try=${encodeURIComponent(entry.id)}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand/90"
            >
              Try this in the validator →
            </a>
          )}
        </div>
      )}
    </li>
  );
}

function Example({ label, tone, content }: { label: string; tone: 'bad' | 'good'; content: string }) {
  const styles =
    tone === 'bad'
      ? 'border-rose-500/30 bg-rose-500/[0.06]'
      : 'border-emerald-500/30 bg-emerald-500/[0.06]';
  const dot = tone === 'bad' ? 'bg-rose-400' : 'bg-emerald-400';
  return (
    <div className={`rounded-lg border ${styles}`}>
      <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
        {label}
      </div>
      <pre className="scroll-thin overflow-x-auto px-3 py-2 text-xs leading-relaxed text-zinc-200">
        <code>{content}</code>
      </pre>
    </div>
  );
}
