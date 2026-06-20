import Link from 'next/link';
import { GITHUB_URL } from '@/lib/links';
import { QrZoom } from './QrZoom';

// Static so server and client render identically (no hydration mismatch from
// reading the clock at render time).
const YEAR = 2026;

/** Site footer with the unaffiliated disclaimer and open-source calls-to-action. */
export function Footer() {
  return (
    <footer className="mt-20 border-t border-white/10 bg-ink/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2">
        <div>
          <div className="flex items-center gap-2 font-semibold text-white">
            <span
              aria-hidden
              className="inline-flex h-6 w-6 items-center justify-center rounded bg-brand text-xs font-bold text-white"
            >
              ✓
            </span>
            agent<span className="text-brand-fg">lint</span>
          </div>
          <p className="mt-3 max-w-sm text-sm text-zinc-400">
            Lint and security-check your AI coding-agent configuration: Claude Code
            (<code className="text-zinc-300">CLAUDE.md</code>, subagents, commands,
            settings) and MCP. Your pasted config is validated entirely in your
            browser and never leaves the page.
          </p>
          <nav aria-label="Footer" className="mt-4 flex flex-wrap gap-4 text-sm text-zinc-400">
            <Link href="/" className="hover:text-white">
              Validator
            </Link>
            <Link href="/rules" className="hover:text-white">
              Rules
            </Link>
            <Link href="/templates" className="hover:text-white">
              Templates
            </Link>
          </nav>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-white">Free &amp; open source</h2>
          <p className="mt-2 text-sm text-zinc-400">
            agentlint is a free, MIT-licensed tool — no accounts, no paywall, nothing
            to buy. If it saved you some trouble, a star or a coffee is a kind way to
            say thanks. Both are entirely optional.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              <span aria-hidden>⭐</span> Star on GitHub
            </a>
          </div>

          <div className="mt-6 flex items-start gap-4">
            <QrZoom />
            <div className="text-sm">
              <h3 className="font-semibold text-white">
                <span aria-hidden>☕</span> Buy me a coffee
              </h3>
              <p className="mt-1 text-zinc-400">Scan to support via VietQR (VietinBank)</p>
              <p className="mt-1 text-xs text-zinc-500">NGUYEN DINH NGUYEN BAC · 109875964393</p>
              <p className="mt-1 text-xs text-brand-fg">Click the QR to enlarge ↗</p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            Unofficial. <strong className="text-zinc-400">Not affiliated with, endorsed
            by, or sponsored by Anthropic.</strong> &quot;Claude&quot; and
            &quot;Claude Code&quot; are trademarks of their respective owners.
          </p>
          <p>
            MIT-licensed &amp; open source · Built by{' '}
            <a
              href="https://bacnguyenne.id.vn"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 underline-offset-2 hover:text-white hover:underline"
            >
              Bac Nguyen
            </a>{' '}
            · © {YEAR} agentlint
          </p>
        </div>
      </div>
    </footer>
  );
}
