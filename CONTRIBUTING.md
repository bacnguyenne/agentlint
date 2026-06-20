# Contributing to agentlint

Thanks for helping make agentlint better! New **rules** for misconfigurations you've hit in the wild are the most valuable contribution. This guide covers dev setup, how to add a rule, and what we expect in a PR.

agentlint is **unofficial** and not affiliated with Anthropic. By contributing, you agree your contribution is licensed under the project's [MIT License](./LICENSE).

## Repository layout

This is an npm workspaces monorepo:

| Path | Workspace | What it is |
|---|---|---|
| `packages/core` | `agentlint-core` | The validation & security engine (pure TS, only dep: `yaml`). |
| `packages/cli` | `agentlint` | The CLI (`--fix`, `--format json`, exit codes). |
| `apps/web` | `@agentlint/web` | The Next.js studio (self-hostable validator). |
| `fixtures/` | — | `good/` and `bad/` sample trees used by CLI integration tests. |
| `docs/` | — | `SPEC.md` (source of truth), `RULES.md`, `DEPLOY.md`. |

## Prerequisites

- **Node.js >= 20** (the repo is developed/tested on 20 and 22; see `.nvmrc`).
- npm (ships with Node).

## Dev setup

```bash
# Install all workspace deps from the lockfile
npm ci

# Build the engine and the CLI (the CLI depends on core's dist)
npm run build            # builds agentlint-core then agentlint
npm run build -w @agentlint/web   # build the web app (optional)

# Run the test suites
npm run test -w agentlint-core   # 205 unit tests
npm run test -w agentlint         # 47 CLI integration tests
npm run test -w @agentlint/web    # web unit tests (vitest)

# Type-check everything
npm run typecheck

# Lint the web app (Next/ESLint)
npm run lint -w @agentlint/web

# Web end-to-end tests (real Chromium)
npx playwright install --with-deps chromium
npm run test:e2e -w @agentlint/web

# Dog-food: lint this repo with the freshly built CLI
npm run lint:self
```

> The CLI test suite runs the **built** binary (`packages/cli/dist/index.js`) over `fixtures/`, so run `npm run build` before `npm run test -w agentlint`.

## How to add a rule

A rule is a small object implementing the `Rule` interface from `agentlint-core` (`packages/core/src/types.ts`). Read [docs/SPEC.md](./docs/SPEC.md) §2–§3 first — it's the source of truth for schemas and the rule catalog.

1. **Pick the group and id.** Rules live in `packages/core/src/rules/` by kind: `agent.ts`, `command.ts`, `settings.ts`, `mcp.ts`, `claudemd.ts`, `security.ts`, plus `core.ts`. Ids are `group/kebab-name` (e.g. `settings/hook-matcher-not-string`). Ids are stable API — choose carefully.

2. **Implement the rule.** Add it to the relevant file and register it in `packages/core/src/rules/index.ts`. A rule declares:
   - `id`, `severity` (`error` | `warning` | `info`), `fixable`, `docsSlug`, `appliesTo` (file kinds), and `meta` (`title`, `description`).
   - `check(ctx)` returning `Finding[]`. It **must never throw, execute, import, or fetch**, and must use bounded, ReDoS-safe regexes.
   - For secret-style findings, **redact** the offending value in the message.
   - If `fixable`, add a `fix(ctx, finding)` that returns the new full file content (fixes operate on the whole content so the engine can re-run).

3. **Add fixtures.** Add a triggering case to `fixtures/bad/...` and make sure `fixtures/good/...` stays clean. Security rules need explicit **false-positive** coverage.

4. **Add tests.** Every rule needs at least one triggering test and one clean test in `packages/core` (vitest). Fixable rules need an autofix idempotency test. Add CLI integration coverage in `packages/cli` if the rule changes the example output or exit behavior.

5. **Update the docs.** Regenerate / update [docs/RULES.md](./docs/RULES.md) so the catalog stays accurate. The rules page in the web app is generated from `core.rules`, so it picks up new rules automatically.

6. **Verify green:**

   ```bash
   npm run build && npm run typecheck \
     && npm run test -w agentlint-core \
     && npm run test -w agentlint
   ```

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(core): add settings/hook-timeout-invalid rule
fix(cli): exit 2 when a target path is a file, not a directory
docs(rules): regenerate catalog after new MCP rule
test(web): cover 413 path for oversized lint bodies
chore(deps): bump yaml to 2.6.1
```

Common types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`, `ci`. Scope is the workspace or area (`core`, `cli`, `web`, `rules`, `deps`).

## Pull request expectations

- Keep PRs focused; one logical change per PR.
- CI must be green (build, typecheck, unit, CLI, web unit, web lint, e2e). See [`.github/workflows/ci.yml`](./.github/workflows/ci.yml).
- Add/adjust tests for any behavior change. New rules require fixtures + tests.
- Don't introduce new runtime dependencies to `agentlint-core` or `agentlint` without discussion — keeping them dependency-light is a core value.
- Don't add telemetry, network calls, or anything that executes user content.
- Update docs (`README.md`, `docs/RULES.md`, package READMEs) when behavior changes.
- Fill in the PR template.

## Reporting bugs / requesting rules

Open an issue using the bug-report or feature-request template. For **security vulnerabilities**, do not open a public issue — follow [SECURITY.md](./SECURITY.md).
