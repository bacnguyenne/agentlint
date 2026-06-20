# Production image for @agentlint/web.
#
# Multi-stage build using Next.js standalone output. Runs as a NON-ROOT user
# (SPEC §7). Build context MUST be the monorepo root so the agentlint-core
# workspace dependency is available:
#
#   docker build -f apps/web/Dockerfile -t agentlint-web .
#   docker run --rm -p 3100:3100 agentlint-web
#
# syntax=docker/dockerfile:1

ARG NODE_VERSION=22-bookworm-slim

# ---- deps: install workspace dependencies ----
FROM node:${NODE_VERSION} AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/cli/package.json packages/cli/
COPY apps/web/package.json apps/web/
RUN npm ci

# ---- builder: build core then the web app ----
FROM node:${NODE_VERSION} AS builder
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
RUN npm run build -w agentlint-core \
  && npm run build -w @agentlint/web

# ---- runner: minimal non-root runtime ----
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3100 \
    HOSTNAME=0.0.0.0 \
    NODE_OPTIONS=--max-old-space-size=512

# Create an unprivileged user.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Standalone output includes a trimmed node_modules and the server entrypoint.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3100

# Liveness/readiness probe. curl is absent from the slim image, so use Node's
# built-in fetch (Node 18+). Exit 0 only when the app answers with an ok status.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3100/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# The standalone server entrypoint for this workspace app.
CMD ["node", "apps/web/server.js"]
