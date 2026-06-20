import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Restrictive FALLBACK Content-Security-Policy.
 *
 * The PRIMARY, per-request CSP carrying a fresh nonce is set in middleware.ts
 * (so Next's inline bootstrap scripts run under `script-src 'nonce-…'` without
 * `unsafe-inline`). next.config headers cannot produce a per-request nonce, so
 * this static policy is a safety net for any route the middleware matcher does
 * NOT cover (e.g. /api/* responses): it still ships a locked-down default-src
 * 'self' policy so nothing is left without a CSP. Where middleware runs, its
 * dynamic header takes precedence (last-writer-wins for the response header).
 *
 * No nonce is available here, so script-src stays 'self' only — API/JSON routes
 * do not execute scripts, making this safe and meaningfully restrictive.
 */
const FALLBACK_CSP = [
  `default-src 'self'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
  `object-src 'none'`,
  `script-src 'self'`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data:`,
  `font-src 'self'`,
  `connect-src 'self'`,
  `manifest-src 'self'`,
  `worker-src 'self' blob:`,
  `frame-src 'none'`,
  `upgrade-insecure-requests`,
].join('; ');

/**
 * Static security headers applied to every response. Includes the fallback CSP
 * above; middleware.ts overrides the CSP with a nonce'd per-request policy on
 * the routes it matches.
 */
const securityHeaders = [
  { key: 'Content-Security-Policy', value: FALLBACK_CSP },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=(), interest-cohort=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Emit a self-contained server bundle for a small, non-root Docker image.
  output: 'standalone',
  // Build output directory. Defaults to `.next`, but `npm run dev` sets
  // NEXT_DIST_DIR=.next-dev so the dev server has its OWN build dir — a
  // production `next build`/`next start` (CI, e2e, verification) can then never
  // corrupt the running dev server's chunks (the "Cannot find module './NNN.js'"
  // 500 that surfaced as a layout.tsx error).
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // Pin the file-tracing root to the monorepo root so Next doesn't get confused
  // by lockfiles elsewhere on the machine.
  outputFileTracingRoot: path.join(__dirname, '..', '..'),
  // The core package is an ESM workspace package shipping compiled JS; tell Next
  // to transpile it so it works inside the app's build pipeline.
  transpilePackages: ['agentlint-core'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
