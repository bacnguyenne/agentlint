import type { Metadata } from 'next';
import Link from 'next/link';
import { Validator } from '@/components/Validator';
import { CATALOG } from '@/lib/catalog';

export const metadata: Metadata = {
  title: 'agentlint — validate your AI agent config',
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
          <code className="text-zinc-300">.mcp.json</code> — agentlint catches the
          real-world misconfigurations and security problems before they bite.
          Also scans cross-tool instruction files: <code className="text-zinc-300">AGENTS.md</code>,
          Cursor, Copilot, Windsurf &amp; Cline.
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-pretty text-sm text-zinc-500">
          Every <span className="text-rose-300">red finding</span> means agentlint caught a real
          problem — that&apos;s the tool working. A valid config shows a green{' '}
          <span className="text-emerald-300">✓ No problems found</span>.
        </p>
        <div className="mt-6">
          <Link
            href="/catalog"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/10 hover:text-white"
          >
            Browse {CATALOG.length} vetted skills, MCP servers &amp; tools
            <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      <Validator />
    </div>
  );
}
