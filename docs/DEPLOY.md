# Deploying agentlint

This guide covers deploying the **web app** (`@agentlint/web`). The **CLI** (`agentlint`) and **engine** (`agentlint-core`) are published to npm — you don't deploy those, you just `npx agentlint` or `npm install agentlint-core`.

> Unofficial — not affiliated with Anthropic.

## What you're deploying

`@agentlint/web` is a Next.js (App Router) app that runs the pure [`agentlint-core`](../packages/core) engine server-side. It stores nothing, makes no outbound calls, and ships strict security headers. It's a normal Next.js deploy with two monorepo wrinkles:

- The app imports the workspace package `agentlint-core`, so the build must have access to the monorepo (or to a built copy of core). `next.config.ts` already sets `transpilePackages: ['agentlint-core']` and pins `outputFileTracingRoot` to the repo root.
- `output: 'standalone'` is enabled for a small, self-contained server bundle (used by the Docker image).

## Option A — Docker (self-host)

The Dockerfile uses Next.js standalone output, runs as a **non-root** user, and has a built-in **healthcheck**. The build context **must be the monorepo root** so the `agentlint-core` workspace dependency resolves.

```bash
# From the repository root:
docker build -f apps/web/Dockerfile -t agentlint-web .

# Run it (port 3100):
docker run --rm -p 3100:3100 -e TRUSTED_PROXY=1 agentlint-web
```

Open http://localhost:3100.

### Healthcheck

The image declares a `HEALTHCHECK` that probes `http://localhost:3100/` using Node's built-in `fetch` (the slim image has no `curl`) and exits non-zero unless the app answers OK. Inspect it with:

```bash
docker inspect --format '{{ .State.Health.Status }}' <container-id>
```

### `TRUSTED_PROXY` (important for rate limiting)

The app rate-limits `/api/lint` and `/api/notify`. Because `X-Forwarded-For` is attacker-spoofable when there's no trusted proxy in front, the app does **not** trust it by default:

- **Behind a reverse proxy / load balancer that sets `X-Forwarded-For`** (nginx, Caddy, Traefik, a cloud LB): set `TRUSTED_PROXY=1`. The limiter then keys off the first XFF token (the real client IP), giving per-client limits.
- **No proxy / unsure**: leave `TRUSTED_PROXY` unset. The limiter applies a single **global** bucket (cannot be bypassed by header spoofing), and logs a one-time warning in production.

| Variable | Default | Purpose |
|---|---|---|
| `TRUSTED_PROXY` | unset | Trust `X-Forwarded-For` for per-client rate limiting (set only behind a real proxy). |
| `PORT` | `3100` | Listen port (set by the image). |
| `NODE_ENV` | `production` (in image) | Enables the strict production CSP. |
| `NEXT_TELEMETRY_DISABLED` | `1` (in image) | Disables Next.js telemetry. |

For multi-instance deployments, the in-memory rate limiter is per-instance; swap `InMemoryRateLimiter` (in `apps/web/src/lib`) for an Upstash-backed implementation of the same interface if you need a shared limit.

## Option B — Vercel

Vercel builds the monorepo natively. Recommended settings:

- **Root Directory:** the repository root (not `apps/web`) — the app needs the workspace to resolve `agentlint-core`. Vercel auto-detects the Next.js app in `apps/web`.
- **Framework preset:** Next.js.
- **Install command:** `npm ci`.
- **Build command:** build the engine first, then the app:
  `npm run build -w agentlint-core && npm run build -w @agentlint/web`
- **Output:** leave to Next.js defaults. (`output: 'standalone'` is harmless on Vercel; `transpilePackages` ensures the ESM core package is bundled correctly.)
- **Environment variables:** Vercel's platform sets a correct, trusted `X-Forwarded-For`, so set `TRUSTED_PROXY=1` to get per-client rate limiting. Set `NEXT_TELEMETRY_DISABLED=1` if desired.

The security headers come from `next.config.ts` (static fallback CSP + the rest) and `middleware.ts` (per-request nonce'd CSP), so they apply on Vercel automatically.

## Other Node hosts

Any host that can run a Next.js standalone server works:

```bash
npm ci
npm run build -w agentlint-core
npm run build -w @agentlint/web
npm run start -w @agentlint/web   # serves on PORT (default 3100)
```

Put it behind TLS and a reverse proxy, and set `TRUSTED_PROXY=1` when that proxy controls `X-Forwarded-For`.

## Post-deploy smoke check

```bash
# Home page returns 200 and ships a CSP header:
curl -sI https://your-host/ | grep -i content-security-policy

# The validator API lints a tiny payload:
curl -s https://your-host/api/lint \
  -H 'content-type: application/json' \
  -d '{"files":[{"path":".mcp.json","content":"{\"mcpServers\": []}"}]}'
```

The second call returns `{ "result": { "findings": [...], "summary": {...} } }`, with a finding flagging `mcp/mcpservers-is-array`.
