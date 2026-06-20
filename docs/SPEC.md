# agentlint — Engineering Spec (source of truth)

`agentlint` lints and **security-checks** AI coding-agent configuration: Claude Code (`CLAUDE.md`, `.claude/agents/*.md`, `.claude/commands/*.md`, `.claude/settings.json` / `settings.local.json`) and MCP (`.mcp.json`). It ships as an open-core product:

- `agentlint-core` — the validation engine (pure TS, dependency-light).
- `agentlint` — the CLI (CI-friendly, `--fix`, JSON output).
- `apps/web` — a Next.js studio: paste config → instant validation + fixes, a rules catalog, and a template gallery.

Brand value: it catches the exact real-world misconfigurations developers make (including the ones our own first drafts made), and flags **security** problems. MIT-licensed core/CLI for adoption; hosted/Pro web features for monetization.

---

## 1. Targets & discovery

Given a directory, discover and classify:
- `CLAUDE.md`, `**/CLAUDE.md` (project & nested), `~/.claude/CLAUDE.md` if scanned.
- `.claude/agents/*.md` → subagents.
- `.claude/commands/**/*.md` → slash commands (subdirs = namespaces).
- `.claude/skills/<name>/SKILL.md` → Agent Skills (any case-variant of `skill.md` is discovered so a non-canonical filename can be flagged).
- `.claude/settings.json`, `.claude/settings.local.json` → settings.
- `.mcp.json` (repo root) → MCP servers.
Respect `.gitignore`-style ignores and an explicit `ignore` config. Never follow symlinks outside the root. Never execute any file.

---

## 2. Schemas (what "valid" means)

### 2.1 Subagent (`.claude/agents/<name>.md`)
YAML frontmatter + Markdown body (system prompt).
- `name` (required): lowercase letters, digits, hyphens (`^[a-z][a-z0-9-]*$`).
- `description` (required): non-empty string (the auto-delegation trigger).
- `tools` (optional): comma-separated list OR YAML list of known tool names. Known: `Read, Write, Edit, MultiEdit, Bash, Grep, Glob, WebFetch, WebSearch, Task, NotebookEdit, TodoWrite` (+ `mcp__*` allowed). Omitted = inherit all.
- `model` (optional): one of `inherit | opus | sonnet | haiku` or a model-id matching `^claude-[a-z0-9.-]+$` **without** a `-latest` suffix. Omitted = session model.
- Body: must be non-empty.

### 2.2 Slash command (`.claude/commands/<name>.md`)
Optional YAML frontmatter + body.
- Allowed frontmatter keys: `description`, `argument-hint`, `allowed-tools`, `model`, `disable-model-invocation`. Unknown keys → warn.
- `allowed-tools` (optional): string or list of tool/permission specs (e.g. `Bash(git*)`).
- Body must be non-empty. `$ARGUMENTS`/`$1`…, `!\`cmd\``, `@file` are valid.

### 2.3 Skill (`.claude/skills/<name>/SKILL.md`)
A Claude Code **Agent Skill**: a directory under `.claude/skills/` whose `SKILL.md` has YAML frontmatter + a Markdown instructions body. Supporting files (`scripts/`, `references/`, `assets/`) live alongside it and load on demand.
- The file MUST be named exactly `SKILL.md` (case-sensitive). `skill.md`/`Skill.md` are silently ignored by Claude Code → error.
- `name` (required): `^[a-z][a-z0-9-]*$`, ≤ 64 chars, and MUST equal the parent skill directory name.
- `description` (required): non-empty; should state WHAT the skill does AND WHEN to use it (drives discovery). Practical cap ≈ 1024 chars.
- `allowed-tools` (optional): space/comma-separated tools or a YAML list (e.g. `Read Bash(git:*)`); each entry must be a known tool (or `mcp__*`) and should not pre-approve unrestricted shell (`*`, `Bash`, `Bash(*)`).
- Other recognized keys: `license`, `compatibility`, `metadata`, `version`, `author`, and Claude Code extensions `model`, `argument-hint`, `user-invocable`, `disable-model-invocation`, `context`, `effort`, `when_to_use`, `hooks`. Unknown keys (e.g. `allowed_tools`) → warn.
- `model` (optional): alias `inherit|opus|sonnet|haiku` or a pinned `claude-*` id (no `-latest`).
- Body: the instructions; must be non-empty. Cross-cutting **security** rules also scan it for hardcoded secrets and remote-code-execution patterns.

### 2.4 settings.json (`.claude/settings.json`, `settings.local.json`)
Strict JSON object. Notable keys: `permissions {allow[],deny[],ask[]}`, `hooks`, `model`, `env`, `statusLine`, `outputStyle`, `includeCoAuthoredBy`, `cleanupPeriodDays`, `enableAllProjectMcpServers`, etc.
**Hooks** (the high-bug area):
```json
{ "hooks": {
    "<EventName>": [
      { "matcher": "<string regex over tool name, or ''>",
        "hooks": [ { "type": "command", "command": "<shell>", "timeout": 30 } ] }
    ] } }
```
- `hooks` MUST be an **object keyed by event name** (NOT an array).
- Valid events: `PreToolUse, PostToolUse, UserPromptSubmit, Stop, SubagentStop, Notification, SessionStart, SessionEnd, PreCompact`.
- `matcher` MUST be a **string** (or omitted/`""`), NOT an object like `{ "toolName": ... }`.
- each handler: `{ "type": "command", "command": string, "timeout"?: number }`.
- `model` (if present): alias `opus|sonnet|haiku|default` or valid id (no `-latest`).

### 2.5 .mcp.json (repo root)
Strict JSON.
- Top-level `mcpServers` (required): an **object/map keyed by server name** (NOT an array).
- stdio server: `{ "command": string, "args"?: string[], "env"?: object }`.
- remote server: `{ "type": "http"|"sse", "url": string, "headers"?: object }`.
- A server with neither `command` nor `url` → error.

### 2.6 CLAUDE.md
Freeform Markdown. Heuristics only: extremely large file (context bloat) → warn; empty → warn.

---

## 3. Rule catalog (id · severity · fixable · message)

Severities: `error` (exit 1), `warning`, `info`. Each rule has a stable `id`, a `docs` slug, and may be `fixable`.

### Subagent — `agent/*`
| id | sev | fix | check |
|---|---|---|---|
| agent/missing-frontmatter | error | – | no YAML frontmatter block |
| agent/missing-name | error | – | frontmatter has no `name` |
| agent/invalid-name | error | yes | `name` not `^[a-z][a-z0-9-]*$` (slugify fix) |
| agent/name-filename-mismatch | warning | yes | `name` ≠ file basename |
| agent/missing-description | error | – | no/empty `description` |
| agent/unknown-tool | warning | – | a tool not in the known set / not `mcp__*` |
| agent/invalid-model | error | yes | `model` invalid or uses `-latest` (fix → `inherit`) |
| agent/empty-body | error | – | no system-prompt body |

### Command — `command/*`
| command/invalid-frontmatter | error | – | YAML parse error |
| command/unknown-key | warning | – | key not in allowed set |
| command/empty-body | error | – | no body |
| command/invalid-model | warning | yes | bad model value |

### Skill — `skill/*` (`.claude/skills/<name>/SKILL.md`)
| id | sev | fix | check |
|---|---|---|---|
| skill/missing-frontmatter | error | – | no YAML frontmatter block |
| skill/invalid-frontmatter | error | – | YAML parse error |
| skill/filename-not-canonical | error | – | file is not exactly `SKILL.md` (silently ignored by Claude Code) |
| skill/missing-name | error | – | frontmatter has no `name` |
| skill/invalid-name | error | yes | `name` not `^[a-z][a-z0-9-]*$` or > 64 chars (slugify+truncate fix) |
| skill/name-dir-mismatch | warning | yes | `name` ≠ parent skill directory name |
| skill/missing-description | error | – | no/empty `description` |
| skill/description-too-long | warning | – | `description` > 1024 chars |
| skill/description-missing-trigger | info | – | `description` doesn't say WHEN to use the skill |
| skill/unknown-key | warning | – | frontmatter key not recognized (e.g. `allowed_tools`) |
| skill/metadata-reserved-key | info | – | `version`/`author`/`license` nested under `metadata` (should be top-level) |
| skill/invalid-model | warning | – | `model` invalid or uses `-latest` |
| skill/unknown-allowed-tool | warning | – | an `allowed-tools` entry is not a known tool / `mcp__*` |
| skill/broad-allowed-tools | warning | – | `allowed-tools` pre-approves `*`, `Bash`, or `Bash(*)` |
| skill/empty-body | error | – | no instructions body after the frontmatter |

(Skills are also covered by the cross-cutting `security/hardcoded-secret` and `security/remote-code-execution` rules.)

### Settings — `settings/*`
| settings/invalid-json | error | – | not parseable JSON |
| settings/hooks-not-object | error | yes | `hooks` is an array (legacy/flat form) → migrate to event-keyed object |
| settings/hook-matcher-not-string | error | yes | matcher is an object (`{toolName}`) not a string |
| settings/hooks-unknown-event | warning | – | event key not in the valid set |
| settings/hook-missing-command | error | – | handler missing `type:"command"`/`command` |
| settings/invalid-model | warning | yes | bad model value |
| settings/unknown-key | info | – | unrecognized top-level key |

### MCP — `mcp/*`
| mcp/invalid-json | error | – | not parseable |
| mcp/missing-mcpservers | error | – | no `mcpServers` |
| mcp/mcpservers-is-array | error | yes | `mcpServers` is an array, not an object map |
| mcp/server-missing-endpoint | error | – | server has neither `command` nor `url` |
| mcp/invalid-transport | warning | – | `type` not in {http,sse} (stdio = no type) |
| mcp/unknown-server-key | info | – | unexpected key in a server entry |

### Security — `security/*` (the differentiator)
| security/hardcoded-secret | error | – | literal token/key/password in `.mcp.json` (headers/env), settings `env`, or CLAUDE.md. Patterns: `sk-…`, `ghp_/gho_/github_pat_…`, `AKIA…`, `Bearer <literal>` (not `${...}`), `xox[baprs]-…`, `AIza…`, private-key headers, high-entropy strings in secret-named fields. Recommend `${ENV_VAR}`. |
| security/dangerous-hook-command | error | – | hook `command` contains `rm -rf`, `:(){`, `mkfs`, `dd if=`, `chmod 777`, `> /dev/sd`, `sudo`, `eval` of untrusted input |
| security/remote-code-execution | error | – | `curl …\| sh`, `wget …\| sh`, `iex(…)`, piping remote script to a shell (in hooks/commands/mcp args) |
| security/mcp-http-no-auth | warning | – | `type:http|sse` server with no `Authorization`/auth header |
| security/broad-permissions | warning | – | settings `permissions.allow` contains `"*"`, `"Bash(*)"`, or `Bash` unrestricted |
| security/unpinned-mcp-package | info | – | mcp stdio uses `npx`/`uvx` without a pinned `@version` (supply-chain) |
| security/secret-named-env-plaintext | warning | – | `env`/`headers` value for a secret-named key is a plaintext literal, not `${...}` |
| security/suspicious-instruction | warning | – | prompt-injection / data-exfiltration directive in a markdown body ("ignore previous instructions", "exfiltrate", "don't tell the user", …) |

Each rule MUST have: stable id, message (with the offending value redacted for secrets), file + line/col when locatable, a short `docs` explanation, and (if fixable) a safe text edit. **No rule may execute or fetch anything.**

---

## 4. Core API (`agentlint-core`)

```ts
export interface Finding {
  ruleId: string; severity: 'error'|'warning'|'info';
  message: string; file: string; line?: number; column?: number;
  fixable: boolean; docsSlug: string;
}
export interface LintResult {
  findings: Finding[];
  summary: { errors: number; warnings: number; infos: number; filesChecked: number };
}
export interface LintOptions { fix?: boolean; rules?: Record<string,'off'|'error'|'warning'|'info'>; ignore?: string[]; cwd?: string; }
export function lintDirectory(dir: string, opts?: LintOptions): Promise<LintResult>;
export function lintFiles(files: {path:string; content:string; kind?: FileKind}[], opts?: LintOptions): LintResult; // pure, used by web
export const rules: Rule[]; // catalog, for docs/web
```
- Pure functions; filesystem only in `lintDirectory`. `lintFiles` is pure (no I/O) — the web app uses it on pasted text.
- Deps: `yaml` (frontmatter), tolerant JSON parsing with line/col (hand-rolled or `jsonc-parser`). Keep deps minimal & audited.
- All regexes must be **ReDoS-safe** (bounded, no catastrophic backtracking). Inputs size-capped.

## 5. CLI (`agentlint`)
- `agentlint [paths…]` (default `.`): lint; pretty "stylish" output grouped by file; summary; exit `0` (no errors), `1` (errors found), `2` (usage/IO error).
- `--fix` apply safe fixes · `--format json|stylish` · `--quiet` (errors only) · `--max-warnings <n>` · `--no-color` · `agentlint init` (writes `.agentlintrc.json`) · `--version`/`--help`.
- Config: `.agentlintrc.json` (`rules`, `ignore`). Reads from cwd upward.
- Tested by running the built CLI against fixtures with `execa`, asserting exit codes + output.

## 6. Web app (`apps/web`, Next.js App Router + TS + Tailwind)
- **/** Validator: textarea/upload + file-kind selector (auto-detect) → POST `/api/lint` → server runs `lintFiles` → render findings with severity, line, message, fix preview, docs link. No persistence (privacy); no account needed in v1.
- **/rules** catalog (generated from `core.rules`).
- **/templates** gallery of vetted configs (cross-sell the packs) — static, copy-to-clipboard.
- **/api/lint** POST: strict input size limit (e.g. 256KB), rate-limited (in-memory/Upstash-ready), no eval, returns JSON findings. CSRF-safe (no cookies/state), strict security headers (CSP, X-Content-Type-Options, etc.) via middleware.
- A "Pro / notify me" email capture (no PII storage beyond an email, clearly consented) — optional.

## 7. Security requirements (product-wide)
- Never execute, import, eval, or network-fetch user-provided content. Parsing only.
- Size limits on all inputs; ReDoS-safe regexes (unit-tested with pathological inputs).
- Web: security headers/CSP, input validation (zod), rate limiting, no secrets in client, `npm audit` clean (no high/critical), pinned deps, Dockerfile runs as non-root.
- Secrets in findings are **redacted** in messages.

## 8. Test strategy (must be RUN, not just written)
- `agentlint-core`: vitest unit tests; every rule has ≥1 triggering fixture + ≥1 clean fixture; security rules tested for false positives; ReDoS tests; autofix idempotency tests. Target ≥90% coverage.
- `agentlint` CLI: integration tests running the built binary over `fixtures/` asserting exit codes + JSON.
- `apps/web`: API route unit tests (vitest) + Playwright E2E (real Chromium — installable here) for the validator happy/error paths + security-header assertions.
- CI (GitHub Actions): install → typecheck → lint → unit → build → e2e → `npm audit`. Docker image builds and a container smoke test passes.

## 9. Definition of Done (production-ready)
- `npm ci && npm run build && npm test` green from a clean clone.
- CLI works on real `.claude/`/`.mcp.json` and on this repo's own fixtures.
- Web app builds, runs, passes E2E, sets security headers, handles malformed input safely.
- Docker image builds and serves; container smoke test green.
- `npm audit` no high/critical; security-review pass with no open criticals.
- Docs: root README, per-package README, rules docs, CONTRIBUTING, LICENSE (MIT), deploy guide.
