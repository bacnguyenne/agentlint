import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Content-Security-Policy for the server (standalone/Docker) build.
 *
 * Why `script-src` allows 'unsafe-inline' here — and why a nonce is not an
 * option: every route in this app is statically prerendered (`○ (Static)` in the
 * build output), so the HTML is generated once at build time. A per-request
 * nonce from middleware can never be stamped onto that HTML, and Next's
 * hydration payload ships as an inline `<script>self.__next_f.push(…)</script>`.
 * A nonce'd policy therefore blocks the app's own bootstrap: the page renders,
 * then never hydrates — no client JavaScript at all. (That is exactly what
 * happened after middleware.ts was removed for the static-export migration: the
 * e2e suite went red because nothing on the page was interactive.)
 *
 * This matches the policy the static export already ships in a <meta> tag (see
 * app/layout.tsx) — same trade-off, same reasoning: the app has no backend
 * state, stores nothing, sets no cookies, and never renders pasted input as HTML
 * (results are React-escaped text), so the residual XSS surface is minimal.
 * Everything else stays locked down: default-src 'self', object-src 'none',
 * frame-ancestors 'none', and no remote origins beyond the read-only GitHub API.
 */
const FALLBACK_CSP = [
  `default-src 'self'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
  `object-src 'none'`,
  `script-src 'self' 'unsafe-inline'`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data:`,
  `font-src 'self'`,
  // api.github.com: the /collections page refreshes repo star counts live
  // (read-only, unauthenticated GET; nothing is sent).
  `connect-src 'self' https://api.github.com`,
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

// Static export (GitHub Pages) when NEXT_EXPORT=1; otherwise a standalone server
// bundle (Docker/Vercel). NEXT_PUBLIC_BASE_PATH lets project Pages serve under
// /<repo> (e.g. /agentcheck).
const isExport = process.env.NEXT_EXPORT === '1';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // 'export' = fully static (no server); 'standalone' = self-contained server bundle.
  output: isExport ? 'export' : 'standalone',
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  // Trailing slashes make every route a directory (foo/index.html), which aligns
  // the static RSC-prefetch paths under a basePath — removes the harmless
  // `/<base>.txt?_rsc=` 404 the home-link prefetch otherwise produces on Pages.
  ...(isExport ? { trailingSlash: true } : {}),
  // GitHub Pages has no image-optimization server; export requires this.
  images: { unoptimized: true },
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
  transpilePackages: ['agentcheck-core'],
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // agentcheck-core's index top-level-imports a filesystem `discover`
      // (node:fs/node:path) that the browser never calls — we only use the pure
      // `lintFiles`. Strip the `node:` URI scheme so webpack can apply fallbacks,
      // then stub the builtins to empty modules for the client bundle.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: { request: string }) => {
          resource.request = resource.request.replace(/^node:/, '');
        }),
      );
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        url: false,
      };
    }
    return config;
  },
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
