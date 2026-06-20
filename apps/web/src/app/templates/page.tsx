import 'server-only';
import type { Metadata } from 'next';
import { TEMPLATES } from '@/lib/templates';
import { SKILL_CATALOG } from '@/lib/skill-catalog';
import { CopyButton } from '@/components/CopyButton';

export const metadata: Metadata = {
  title: 'Templates',
  description:
    'Vetted, correct starting points for Claude Code and MCP configuration: CLAUDE.md, a subagent, a slash command, settings.json with hooks, and .mcp.json.',
};

export default function TemplatesPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">Templates</h1>
        <p className="mt-2 text-zinc-400">
          Correct, copy-paste starting points. Every snippet here passes agentlint
          with zero findings — use them as a known-good baseline.
        </p>
      </header>

      <div className="space-y-8">
        {TEMPLATES.map((t) => (
          <article
            key={t.id}
            className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-white">{t.title}</h2>
                <p className="text-xs text-zinc-500">{t.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <code className="hidden font-mono text-xs text-zinc-400 sm:inline">
                  {t.filename}
                </code>
                <CopyButton value={t.content} />
              </div>
            </div>
            <pre className="scroll-thin overflow-x-auto bg-black/40 p-4 font-mono text-xs leading-relaxed text-zinc-200">
              <code>{t.content}</code>
            </pre>
          </article>
        ))}
      </div>

      {SKILL_CATALOG.length > 0 && (
        <section className="mt-14">
          <header className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Curated skills{' '}
              <span className="align-middle text-sm font-medium text-zinc-500">
                ({SKILL_CATALOG.length})
              </span>
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Agent Skills (<code className="font-mono text-xs">SKILL.md</code>) synced from upstream
              repositories and <span className="text-zinc-200">validated by agentlint</span> — every
              one passes with zero errors. Refreshed automatically each week.
            </p>
          </header>

          <div className="grid gap-4 sm:grid-cols-2">
            {SKILL_CATALOG.map((s) => (
              <article
                key={s.id}
                className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-mono text-sm font-semibold text-white">{s.name}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-400">{s.description}</p>
                  </div>
                  {s.license && (
                    <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                      {s.license}
                    </span>
                  )}
                </div>
                <div className="mt-auto flex items-center justify-between gap-3">
                  {s.source === 'local' ? (
                    <span className="text-xs text-zinc-500">bundled</span>
                  ) : (
                    <a
                      href={s.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-brand-fg hover:underline"
                    >
                      source ↗
                    </a>
                  )}
                  <CopyButton value={s.content} />
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
