import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

/**
 * Content-Security-Policy for the static site. GitHub Pages can't set response
 * headers, so we ship the CSP as a <meta> tag. `script-src` needs 'unsafe-inline'
 * because Next's static bootstrap scripts carry no per-request nonce without a
 * server — an acceptable trade-off here: the app has no backend, stores nothing,
 * and never renders pasted input as HTML (results are React-escaped text), so the
 * residual XSS surface is minimal. (The server/Docker build keeps the stricter
 * nonce'd CSP via next.config headers.)
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  // Note: frame-ancestors / X-Frame-Options only work as response headers, which
  // static GitHub Pages can't set — omitted here (the app has no sensitive
  // state to clickjack). The server/Docker build still sets them via headers.
  "form-action 'self'",
].join('; ');

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta httpEquiv="Content-Security-Policy" content={CSP} />
      </head>
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
