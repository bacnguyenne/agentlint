import type { Metadata } from 'next';
import Link from 'next/link';
import { Validator } from '@/components/Validator';
import { CATALOG } from '@/lib/catalog';
import { DIRECTORY_COUNTS } from '@/lib/repo-directory';

export const metadata: Metadata = {
  title: 'agentcheck — validate your AI agent config',
  description:
    'Paste a CLAUDE.md, subagent, slash command, settings.json or .mcp.json and get instant validation plus security checks. Nothing is stored.',
};

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <section className="mb-10 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
          Validation runs in your browser · nothing leaves the page
        </span>
        <h1 className="mt-5 text-balance text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Lint &amp; secure your{' '}
          <span className="bg-gradient-to-r from-brand-fg to-sky-300 bg-clip-text text-transparent">
            AI agent config
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-pretty text-base text-zinc-400 sm:text-lg">
          Paste a <code className="text-zinc-300">CLAUDE.md</code>, subagent, slash
          command, <code className="text-zinc-300">settings.json</code> or{' '}
          <code className="text-zinc-300">.mcp.json</code> — agentcheck catches the
          real-world misconfigurations and security problems before they bite.
          Also scans cross-tool instruction files: <code className="text-zinc-300">AGENTS.md</code>,
          Cursor, Copilot, Windsurf &amp; Cline.
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-pretty text-sm text-zinc-500">
          Every <span className="text-rose-300">red finding</span> means agentcheck caught a real
          problem — that&apos;s the tool working. A valid config shows a green{' '}
          <span className="text-emerald-300">✓ No problems found</span>.
        </p>
        {/* Three things you can do here — the whole product, at a glance. */}
        <div className="mt-8 grid gap-3 text-left sm:grid-cols-3">
          {[
            {
              href: '#validate',
              icon: '✓',
              title: 'Validate a config',
              body: 'Paste it below. Rules, secret scanning and permission checks, all in your browser.',
              cta: 'Start below',
            },
            {
              href: '/catalog',
              icon: '📦',
              title: 'Install building blocks',
              body: `${CATALOG.length} vetted skills, MCP servers & tools — copy, download, or npx @bacnguyenne/agentcheck add.`,
              cta: 'Open the catalog',
            },
            {
              href: '/collections',
              icon: '🧭',
              title: 'Explore the ecosystem',
              body: `${DIRECTORY_COUNTS.all} GitHub repos grouped into collections — coding, office, writing, research & more.`,
              cta: 'Browse collections',
            },
          ].map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-brand-fg/30 hover:bg-white/[0.06]"
            >
              <span aria-hidden className="text-lg">
                {c.icon}
              </span>
              <h2 className="mt-1.5 font-semibold text-white">{c.title}</h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">{c.body}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-fg">
                {c.cta}
                <span aria-hidden className="transition group-hover:translate-x-0.5">
                  →
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div id="validate" className="scroll-mt-20">
        <Validator />
      </div>
    </div>
  );
}
