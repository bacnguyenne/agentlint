import 'server-only';
import type { Metadata } from 'next';
import { CATALOG, CATALOG_COUNTS } from '@/lib/catalog';
import { CatalogBrowser } from '@/components/CatalogBrowser';

export const metadata: Metadata = {
  title: 'Catalog — skills, MCP servers & tools',
  description:
    'Find and download vetted Claude Code Agent Skills, MCP servers, and tools (subagents & slash commands). Every item is validated by agentlint with zero errors. Search, filter, copy, or download all.',
};

export default function CatalogPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">Catalog</h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          {CATALOG.length} vetted Claude Code building blocks — Agent{' '}
          <span className="text-zinc-200">Skills</span>,{' '}
          <span className="text-zinc-200">MCP servers</span>, and{' '}
          <span className="text-zinc-200">tools</span> (subagents &amp; slash commands). Every item is{' '}
          <span className="text-zinc-200">validated by agentlint</span> (zero errors) and uses{' '}
          <code className="font-mono text-xs">${'{ENV_VAR}'}</code> references instead of secrets.
          Search, copy a snippet, or download one — or grab them all.
        </p>
      </header>

      <details open className="group mb-8 rounded-xl border border-brand-fg/20 bg-brand/[0.06] p-4">
        <summary className="cursor-pointer list-none text-sm font-semibold text-white">
          <span className="mr-1 inline-block transition group-open:rotate-90">▸</span> How to use these (skills, MCP servers &amp; tools) — read me first
        </summary>

        <div className="mt-4 space-y-4 text-sm text-zinc-400">
          <div>
            <p className="font-medium text-zinc-200">Three ways to install:</p>
            <ol className="mt-1.5 list-decimal space-y-1.5 pl-5">
              <li>
                <span className="text-zinc-200">CLI (easiest)</span> — run{' '}
                <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs text-zinc-200">npx agentlint add &lt;id&gt;</code>{' '}
                in your project. It writes the file to the right path; MCP servers <span className="text-zinc-200">merge</span> into your <code className="font-mono text-xs">.mcp.json</code>.
              </li>
              <li>
                <span className="text-zinc-200">Download .zip</span> — grab the archive, then{' '}
                <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs text-zinc-200">unzip agentlint-catalog.zip -d your-project</code>. Files land in the correct <code className="font-mono text-xs">.claude/…</code> structure with a merged <code className="font-mono text-xs">.mcp.json</code> and a README.
              </li>
              <li>
                <span className="text-zinc-200">Copy &amp; paste</span> — open <span className="text-zinc-200">Preview</span>, copy, and paste into the file at the path shown on the card.
              </li>
            </ol>
          </div>

          <div>
            <p className="font-medium text-zinc-200">Where files go &amp; how to enable:</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 font-mono text-xs">
              <li>skill → <span className="text-zinc-300">.claude/skills/&lt;name&gt;/SKILL.md</span></li>
              <li>subagent → <span className="text-zinc-300">.claude/agents/&lt;name&gt;.md</span></li>
              <li>slash command → <span className="text-zinc-300">.claude/commands/&lt;name&gt;.md</span></li>
              <li>MCP server → <span className="text-zinc-300">.mcp.json</span></li>
            </ul>
            <p className="mt-1.5">
              Then <span className="text-zinc-200">restart Claude Code</span> so it discovers them, and set any <span className="text-amber-300/90">🔑 env vars</span> a server needs.
            </p>
          </div>

          <div>
            <p className="font-medium text-zinc-200">Security:</p>
            <p className="mt-1.5">
              Every item carries a <span className="text-emerald-300">✓ agentlint</span> badge — it passed agentlint with <span className="text-zinc-200">zero errors</span>: no hardcoded secrets, no remote-code-execution patterns, and no over-broad tool/permission grants. Credentials are always{' '}
              <code className="font-mono text-xs">${'{ENV_VAR}'}</code> references — you set them yourself; nothing secret is shipped. Re-check anything you add with <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs text-zinc-200">npx agentlint</code>.
            </p>
          </div>
        </div>
      </details>

      <CatalogBrowser items={CATALOG} counts={CATALOG_COUNTS} />
    </div>
  );
}
