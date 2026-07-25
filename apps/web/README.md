# @agentcheck/web

The **agentcheck studio** — a small Next.js (App Router) web app that lets you paste an AI coding-agent config and get instant validation and security checks, browse the rules catalog, and copy vetted config templates.

It runs the same pure [`agentcheck-core`](../../packages/core) engine on the server (via `lintFiles`), so it **never executes, imports, or fetches** your input — it only parses it. There is **no persistence**: nothing you paste is stored.

> Unofficial — not affiliated with Anthropic.

## Pages & API

- **`/`** — Validator: paste or upload a config, pick (or auto-detect) the file kind, and see findings with severity, line:col, message, fix preview, and a docs link.
- **`/rules`** — the rule catalog, generated from `agentcheck-core`'s `rules`.
- **`/templates`** — a gallery of vetted configs, copy-to-clipboard.
- **`POST /api/lint`** — runs `lintFiles` server-side. Strict input limits (256 KiB total body, max 20 files, max 1024-char paths), rate-limited, returns JSON findings. Returns `413` for oversized bodies.
- **`POST /api/notify`** — optional "notify me" email capture (rate-limited).

## Run locally

From the **monorepo root** (the web app depends on the built `agentcheck-core`):

```bash
npm ci
npm run build -w agentcheck-core   # build the engine the web app imports
npm run dev -w @agentcheck/web      # dev server on http://localhost:3100
```

### Build & start (production)

```bash
npm run build -w @agentcheck/web    # Next.js standalone build
npm run start -w @agentcheck/web    # serve on http://localhost:3100
```

### Tests

```bash
npm run test -w @agentcheck/web                 # vitest unit tests
npx playwright install --with-deps chromium
npm run test:e2e -w @agentcheck/web             # Playwright E2E (real Chromium)
```

## Run with Docker

The image is built from the **monorepo root** so the `agentcheck-core` workspace dependency is available. It uses Next.js standalone output and runs as a **non-root** user with a built-in healthcheck.

```bash
# From the repo root:
docker build -f apps/web/Dockerfile -t agentcheck-web .
docker run --rm -p 3100:3100 -e TRUSTED_PROXY=1 agentcheck-web
```

Then open http://localhost:3100. See [docs/DEPLOY.md](../../docs/DEPLOY.md) for Vercel and production notes.

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `TRUSTED_PROXY` | unset | Set to `1`/`true` **only when** the app sits behind a proxy that controls `X-Forwarded-For`. When set, rate limiting keys off the first XFF token (the real client IP). When **unset**, `X-Forwarded-For` is *not* trusted (it's attacker-spoofable) and the rate limit applies as a single **global** bucket; a one-time warning is logged in production. |
| `PORT` | `3100` | Port the server listens on (the Docker image sets this). |
| `NODE_ENV` | — | `production` enables the strict (non-dev) CSP. |
| `NEXT_TELEMETRY_DISABLED` | — | Set to `1` to disable Next.js telemetry (the Docker image sets this). |

## Security headers

Every response ships strict headers (SPEC §7):

- **Content-Security-Policy** — a **per-request, nonce'd** policy is set in `middleware.ts` so Next's inline bootstrap scripts run under `script-src 'nonce-…' 'strict-dynamic'` (no `unsafe-inline` in production). A restrictive static fallback CSP in `next.config.ts` covers any route the middleware matcher doesn't (e.g. `/api/*`).
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `frame-ancestors 'none'`
- `Referrer-Policy: no-referrer`, restrictive `Permissions-Policy`
- `Strict-Transport-Security` (HSTS, 2 years, preload)
- `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`
- `X-DNS-Prefetch-Control: off`, `poweredByHeader` disabled

The E2E suite asserts these headers are present.

## License

[MIT](../../LICENSE) © 2026 agentcheck contributors.

☕ Support: scan the VietQR in the [main README](https://github.com/bacnguyenne/agentcheck#-support--buy-me-a-coffee) · ⭐ Star: https://github.com/bacnguyenne/agentcheck
