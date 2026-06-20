import { NextResponse, type NextRequest } from 'next/server';

/**
 * Per-request Content-Security-Policy with a fresh nonce.
 *
 * Next.js (App Router) emits a few inline bootstrap/streaming <script> tags. To
 * keep `script-src` free of `unsafe-inline` (SPEC §7) while still allowing those
 * scripts, we generate a cryptographic nonce per request, put it in the CSP
 * header, and forward it on the request headers. Next reads the nonce from the
 * CSP on the incoming request and stamps it onto its own inline scripts, so they
 * execute under `'nonce-…'` only.
 *
 * In development, React Fast Refresh and the error overlay require `unsafe-eval`
 * (and inline styles), so we relax script-src for dev ONLY.
 */
export function middleware(request: NextRequest): NextResponse {
  const isDev = process.env.NODE_ENV !== 'production';

  // Web Crypto is available in the Edge/middleware runtime.
  const nonce = btoa(crypto.randomUUID());

  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval' 'unsafe-inline'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;

  const csp = [
    `default-src 'self'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    scriptSrc,
    // Styles: Tailwind ships a static stylesheet, but Next/React may inject a
    // few inline <style> tags. Inline styles cannot exfiltrate data the way
    // scripts can; this is the standard Next.js posture.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `manifest-src 'self'`,
    `worker-src 'self' blob:`,
    `frame-src 'none'`,
    `upgrade-insecure-requests`,
  ].join('; ');

  // Forward the nonce + CSP on the request so Next applies the nonce to scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  // Also set CSP on the RESPONSE so the browser enforces it.
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  /**
   * Run on all routes except Next's static assets and the favicon, where a CSP
   * nonce is unnecessary and would add per-asset overhead.
   */
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
