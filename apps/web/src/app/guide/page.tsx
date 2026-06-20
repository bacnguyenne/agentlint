import 'server-only';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CATALOG_COUNTS } from '@/lib/catalog';

export const metadata: Metadata = {
  title: 'Guide — how to use agentlint',
  description:
    'How to validate your Claude Code & MCP configuration, and how to find, install, and secure skills, MCP servers, and tools from the catalog.',
};

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[0.85em] text-zinc-200">{children}</code>;
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-white/10 pt-8">
      <h2 className="text-xl font-bold tracking-tight text-white">
        <span className="mr-2 text-brand-fg">{n}</span>
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-400">{children}</div>
    </section>
  );
}

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">Guide</h1>
        <p className="mt-2 text-zinc-400">
          Everything you need to use agentlint — validate your config, then find, install, and secure
          skills, MCP servers, and tools for Claude Code.
        </p>
      </header>

      <div className="space-y-8">
        <Section n="1" title="What agentlint does">
          <p>
            agentlint <span className="text-zinc-200">lints and security-checks</span> AI coding-agent
            configuration — Claude Code (<Code>CLAUDE.md</Code>, <Code>.claude/agents</Code>,{' '}
            <Code>.claude/commands</Code>, <Code>.claude/skills/**/SKILL.md</Code>,{' '}
            <Code>settings.json</Code>) and MCP (<Code>.mcp.json</Code>). It catches real
            misconfigurations and security problems (hardcoded secrets, dangerous hooks,{' '}
            <Code>curl | sh</Code>, over-broad permissions, prompt-injection) before they bite.
          </p>
        </Section>

        <Section n="2" title="Validate your config (the Validator)">
          <p>
            Open the <Link href="/" className="text-brand-fg hover:underline">Validator</Link>, choose a{' '}
            <span className="text-zinc-200">File kind</span> (or leave auto-detect on), paste or upload
            your config, and press <span className="text-zinc-200">Validate</span>. Each finding shows{' '}
            <Code>line:col</Code>, the rule id (links to{' '}
            <Link href="/rules" className="text-brand-fg hover:underline">Rules</Link>), and a{' '}
            <span className="text-zinc-200">fixable</span> badge where a safe autofix exists. Nothing is
            stored — it lints in memory and returns JSON.
          </p>
          <p>
            From the command line, in your project:
          </p>
          <pre className="overflow-x-auto rounded-md border border-white/10 bg-black/40 p-3 font-mono text-xs text-zinc-200">{`npx agentlint          # lint the whole project
npx agentlint --fix    # apply safe autofixes`}</pre>
        </Section>

        <Section n="3" title="Find skills, MCP servers & tools (the Catalog)">
          <p>
            The <Link href="/catalog" className="text-brand-fg hover:underline">Catalog</Link> has{' '}
            <span className="text-zinc-200">{CATALOG_COUNTS.all}</span> vetted building blocks —{' '}
            {CATALOG_COUNTS.skill} skills, {CATALOG_COUNTS.mcp} MCP servers, and {CATALOG_COUNTS.tool} tools.
            Search, filter by kind, and click <span className="text-zinc-200">Preview</span> to read any item.
          </p>
        </Section>

        <Section n="4" title="Install — three ways">
          <p>
            <span className="font-medium text-zinc-200">A) CLI (easiest)</span> — installs to the right path; MCP servers
            merge into your <Code>.mcp.json</Code> instead of overwriting it:
          </p>
          <pre className="overflow-x-auto rounded-md border border-white/10 bg-black/40 p-3 font-mono text-xs text-zinc-200">{`npx agentlint add --list           # browse every id
npx agentlint add code-reviewer    # a subagent
npx agentlint add ship-feature     # a workflow skill
npx agentlint add mcp-github       # merges into .mcp.json
npx agentlint add mcp-github --dry-run   # preview, write nothing`}</pre>
          <p>
            <span className="font-medium text-zinc-200">B) Download .zip</span> — on the Catalog, click{' '}
            <span className="text-zinc-200">Download .zip</span>, then unzip into your project root. Files land in
            the correct structure (with a merged <Code>.mcp.json</Code> and a README):
          </p>
          <pre className="overflow-x-auto rounded-md border border-white/10 bg-black/40 p-3 font-mono text-xs text-zinc-200">{`unzip agentlint-catalog.zip -d your-project`}</pre>
          <p>
            <span className="font-medium text-zinc-200">C) Copy &amp; paste</span> — open Preview on a card, copy, and
            paste into the file at the path shown.
          </p>
        </Section>

        <Section n="5" title="Where files go & how to enable">
          <ul className="list-disc space-y-1 pl-5 font-mono text-xs">
            <li>skill → <span className="text-zinc-300">.claude/skills/&lt;name&gt;/SKILL.md</span></li>
            <li>subagent → <span className="text-zinc-300">.claude/agents/&lt;name&gt;.md</span></li>
            <li>slash command → <span className="text-zinc-300">.claude/commands/&lt;name&gt;.md</span></li>
            <li>MCP server → <span className="text-zinc-300">.mcp.json</span></li>
          </ul>
          <p>
            Then <span className="text-zinc-200">restart Claude Code</span> so it discovers them, and set any{' '}
            <span className="text-amber-300/90">🔑 env vars</span> a server needs (each MCP card lists them).
          </p>
        </Section>

        <Section n="6" title="Security">
          <p>
            Every catalog item carries a <span className="text-emerald-300">✓ agentlint</span> badge — it passed
            agentlint with <span className="text-zinc-200">zero errors</span>: no hardcoded secrets, no
            remote-code-execution patterns, no over-broad tool/permission grants. Credentials are always{' '}
            <Code>${'{ENV_VAR}'}</Code> references — you set them yourself; nothing secret is shipped. Re-check
            anything you add with <Code>npx agentlint</Code>.
          </p>
        </Section>

        <Section n="7" title="Use it from your agent (MCP)">
          <p>
            agentlint ships an MCP server so an agent can lint its <span className="text-zinc-200">own</span> config.
            Run it with <Code>agentlint mcp</Code> (or the <Code>agentlint-mcp</Code> bin), and point your{' '}
            <Code>.mcp.json</Code> at it:
          </p>
          <pre className="overflow-x-auto rounded-md border border-white/10 bg-black/40 p-3 font-mono text-xs text-zinc-200">{`// .mcp.json
{ "mcpServers": { "agentlint": { "command": "agentlint", "args": ["mcp"] } } }`}</pre>
        </Section>
      </div>
    </div>
  );
}
