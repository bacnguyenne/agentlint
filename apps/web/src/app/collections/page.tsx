import 'server-only';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CollectionsBrowser } from '@/components/CollectionsBrowser';
import {
  COLLECTIONS,
  DIRECTORY,
  DIRECTORY_COUNTS,
  DIRECTORY_UPDATED,
  formatStars,
} from '@/lib/repo-directory';

export const metadata: Metadata = {
  title: 'Collections — skills, MCP & tools repos on GitHub',
  description:
    'A curated directory of the agent ecosystem on GitHub: Agent Skills, MCP servers, SDKs and agent tools, grouped into collections with live star counts. Coding and non-coding: office, writing, marketing, research, creative and personal.',
};

/** Total stars across the directory — a quick sense of scale. */
const TOTAL_STARS = DIRECTORY.reduce((sum, r) => sum + r.stars, 0);

export default function CollectionsPage() {
  const updated = DIRECTORY_UPDATED ? new Date(DIRECTORY_UPDATED).toISOString().slice(0, 10) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">Collections</h1>
        <p className="mt-2 max-w-3xl text-zinc-400">
          The agent ecosystem on GitHub, grouped into collections — Agent{' '}
          <span className="text-zinc-200">Skills</span>, <span className="text-zinc-200">MCP servers &amp; SDKs</span>,
          and <span className="text-zinc-200">agent tools</span>. Coding and non-coding alike: office, writing,
          marketing, research, creative and personal. Star counts refresh live from GitHub.
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { k: 'Repos', v: String(DIRECTORY_COUNTS.all) },
            { k: 'Collections', v: String(COLLECTIONS.length) },
            { k: 'Combined stars', v: formatStars(TOTAL_STARS) },
            { k: 'Last sync', v: updated ?? '—' },
          ].map((s) => (
            <div key={s.k} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <dt className="text-[11px] uppercase tracking-wide text-zinc-500">{s.k}</dt>
              <dd className="mt-0.5 font-semibold text-white">{s.v}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 text-xs text-zinc-500">
          This is a <span className="text-zinc-300">discovery directory</span> — links to upstream repositories,
          nothing is vendored here. For files you can copy or install directly (validated by agentcheck with zero
          errors), see the{' '}
          <Link href="/catalog" className="text-brand-fg hover:underline">
            Catalog
          </Link>
          . Always review third-party skills before installing; <code className="font-mono">npx agentcheck</code> can
          check anything you add.
        </p>
      </header>

      <CollectionsBrowser items={DIRECTORY} />
    </div>
  );
}
