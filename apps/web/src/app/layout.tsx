import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

/**
 * Force dynamic rendering app-wide. This is required for the nonce-based CSP in
 * middleware.ts to work: Next only stamps its inline/bootstrap <script> tags
 * with the request nonce when a route is rendered per-request. Statically
 * prerendered HTML would carry no nonce and the browser would refuse Next's
 * scripts under `script-src 'self' 'nonce-…' 'strict-dynamic'`.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL('https://agentlint.dev'),
  title: {
    default: 'agentlint — lint & secure your AI agent config',
    template: '%s · agentlint',
  },
  description:
    'Paste your Claude Code or MCP configuration and get instant validation plus security checks. CLAUDE.md, subagents, slash commands, settings.json and .mcp.json.',
  applicationName: 'agentlint',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'agentlint',
    description:
      'Lint & security-check your AI coding-agent configuration (Claude Code & MCP).',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0b',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read the per-request nonce set by middleware.ts. Reading the nonce here is
  // what makes Next propagate it to its own inline bootstrap/streaming <script>
  // tags, so `script-src 'self' 'nonce-…' 'strict-dynamic'` actually protects
  // them instead of being decorative. Any future next/script <Script> must be
  // passed this nonce too (e.g. <Script nonce={nonce} … />).
  const nonce = (await headers()).get('x-nonce') ?? '';
  // Reference the nonce so it is unmistakably part of the dynamic render and so
  // future <Script nonce={nonce}> additions have it in scope. Next stamps this
  // same nonce onto its framework bootstrap scripts automatically.
  void nonce;

  return (
    <html lang="en">
      <body className="font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-brand focus:px-3 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <div className="flex min-h-screen flex-col">
          <Header />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
