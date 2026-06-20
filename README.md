# agentlint

**Lint and security-check your AI coding-agent configuration — Claude Code (**`CLAUDE.md`**,** `.claude/agents`**,** `.claude/commands`**,** `.claude/skills/**/SKILL.md`**,** `settings.json`**) and MCP (**`.mcp.json`**).**

![CI](https://github.com/bacnguyenne/agentlint/actions/workflows/ci.yml/badge.svg)![npm version](https://img.shields.io/npm/v/agentlint-cli.svg)![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)![node >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)agentlint is a fast, dependency-light linter that catches the real misconfigurations people make in their AI coding-agent setup — including **security** problems like hardcoded secrets, dangerous hook commands, and `curl | sh` remote-code-execution patterns. It never executes, imports, or fetches your files; it only parses them.

> **Unofficial.** agentlint is a community project and is **not affiliated with, endorsed by, or sponsored by Anthropic.** "Claude" and "Claude Code" are trademarks of Anthropic.

---

## Why

Agent config is JSON and YAML with strict, undocumented-feeling shapes, and a single wrong key silently breaks things or — worse — quietly grants the agent dangerous power:

- `hooks` written as an **array** instead of an event-keyed **object** (so your hooks never fire).
- a hook `matcher` written as `{ "toolName": ... }` instead of a plain **string**.
- `.mcp.json` with `mcpServers` as an **array** instead of an object map.
- a subagent `model` pinned to a `-latest` alias (unsupported), or an `Invalid_Name`.
- a real **secret** (`sk-...`, `ghp_...`, `AKIA...`) committed into `settings.json`, `.mcp.json`, or `CLAUDE.md`.
- `permissions.allow` containing `"*"` or `"Bash(*)"` — an unrestricted agent.
- a hook command containing `rm -rf`, or an MCP arg that pipes a remote script into a shell.

agentlint flags all of these (and more — see [docs/RULES.md](./docs/RULES.md)), with file, line:col, a stable rule id, and a safe autofix where one exists.

## Quick start

No install required:

```bash
# Lint the current directory
npx -p agentlint-cli agentlint

# Apply safe autofixes and write them back
npx -p agentlint-cli agentlint --fix
```

Prefer a global install? `npm install -g agentlint-cli` gives you the `agentlint` and `agentlint-mcp` commands. For the library, `npm install agentlint-core`.

### Example output

Running agentlint on a project with a few mistakes (secrets are **redacted** in the output; some rows trimmed for brevity, but the summary footer reflects the full run):

```text
$ npx -p agentlint-cli agentlint
.claude/agents/Bad_Agent.md
  2:0  error    Subagent name "Bad_Agent" is invalid; it must match ^[a-z][a-z0-9-]*$. Suggested: "bad-agent".   agent/invalid-name (fixable)
  2:0  error    Subagent frontmatter is missing a non-empty `description`.                                       agent/missing-description
  3:0  warning  Subagent references unknown tool "Frobnicate".                                                   agent/unknown-tool
  4:0  error    Subagent model "claude-3-5-sonnet-latest" is invalid. Use inherit|opus|sonnet|haiku ...          agent/invalid-model (fixable)
  7:0  error    Subagent has no system-prompt body after the frontmatter.                                        agent/empty-body

.claude/settings.json
   4:15  warning  Overly broad permission "*" in permissions.allow; scope it (e.g. Bash(git status:*)).          security/broad-permissions
   7:23  error    Hardcoded OpenAI API key detected (sk-proj-***). Use a ${ENV_VAR} reference instead.           security/hardcoded-secret
  12:20  error    Hook matcher under "PreToolUse" must be a string, not object.                                  settings/hook-matcher-not-string (fixable)
  13:51  error    Hook command contains a dangerous operation (rm -rf).                                          security/dangerous-hook-command

.mcp.json
  2:17  error  `mcpServers` is an array; it must be an object keyed by server name.                              mcp/mcpservers-is-array (fixable)

CLAUDE.md
  3:27  error  Hardcoded OpenAI API key detected (sk-***). Use a ${ENV_VAR} reference instead.                   security/hardcoded-secret
  5:20  error  Remote-code-execution pattern detected (curl | sh).                                               security/remote-code-execution

✖ 11 errors, 8 warnings, 1 info (6 fixable)
```

(`agentlint` exits `1` here because errors were found — perfect for CI.)

## What it checks

agentlint ships **58 rules** across eight groups. A few examples — the full catalog with severity, fixability, and a description per rule is in [**docs/RULES.md**](./docs/RULES.md).

| Group | What it covers | Example rule ids |
| --- | --- | --- |
| **Agent** (`.claude/agents/*.md`) | frontmatter shape, `name`/`description`, tools, model | `agent/invalid-name`, `agent/missing-description`, `agent/invalid-model` |
| **Command** (`.claude/commands/**/*.md`) | frontmatter keys, body, model | `command/unknown-key`, `command/empty-body`, `command/invalid-model` |
| **Skill** (`.claude/skills/<name>/SKILL.md`) | the case-sensitive `SKILL.md` filename, `name`↔directory, `description` discovery quality, `allowed-tools`, model | `skill/filename-not-canonical`, `skill/name-dir-mismatch`, `skill/description-missing-trigger`, `skill/broad-allowed-tools` |
| **Settings** (`.claude/settings.json`, `settings.local.json`) | JSON validity, the hooks shape, model | `settings/hooks-not-object`, `settings/hook-matcher-not-string`, `settings/hooks-unknown-event` |
| **MCP** (`.mcp.json`) | JSON validity, `mcpServers` shape, endpoints, transport | `mcp/mcpservers-is-array`, `mcp/server-missing-endpoint`, `mcp/invalid-transport` |
| **Security** (cross-cutting) | hardcoded secrets, dangerous hooks, RCE, **prompt-injection / data-exfiltration directives**, broad permissions, supply chain | `security/hardcoded-secret`, `security/dangerous-hook-command`, `security/remote-code-execution`, `security/suspicious-instruction`, `security/broad-permissions`, `security/unpinned-mcp-package` |

### Linting Agent Skills (`SKILL.md`)

[Agent Skills](https://code.claude.com/docs/en/skills) live in `.claude/skills/<name>/SKILL.md`. The most common ways they break are subtle and silent — agentlint catches them:

- **Wrong filename case** — Claude Code only loads a case-sensitive `SKILL.md`; a `skill.md`/`Skill.md` is silently ignored (`skill/filename-not-canonical`).
- `name` **≠ directory**, or an invalid `name` (uppercase/spaces/underscores, &gt; 64 chars) (`skill/name-dir-mismatch`, `skill/invalid-name`, fixable).
- **A description that says what but not *when*** to use the skill, so Claude rarely loads it (`skill/description-missing-trigger`); or one over 1024 chars (`skill/description-too-long`).
- **Typo'd / unknown frontmatter keys** like `allowed_tools` (`skill/unknown-key`), an invalid `model`, or an `allowed-tools` entry that's unknown or over-broad (`skill/broad-allowed-tools`).
- Plus the cross-cutting **security** rules: hardcoded secrets and `curl | sh` patterns inside a `SKILL.md` body.

The web `/catalog` page also ships a **curated catalog** of 198 real-world items — Skills, MCP servers, and Tools (synced from upstream and validated by agentlint), so you have known-good `SKILL.md` (and `.mcp.json`) examples to start from. Install any of them with `agentlint add <id>`.

## CLI usage

```text
agentlint — lint & security-check your AI coding-agent configuration

Usage:
  agentlint [options] [paths...]
  agentlint init [--force]

Arguments:
  paths                One or more directories to lint (default: ".").

Options:
  --fix                Apply safe autofixes and write files back.
  --format <fmt>       Output format: "stylish" (default) or "json".
  --quiet              Report errors only (suppress warnings and infos).
  --max-warnings <n>   Exit 1 if warnings exceed n (n >= 0).
  --no-color           Disable colored output (also honors NO_COLOR).
  -v, --version        Print the version and exit.
  -h, --help           Show this help and exit.

Commands:
  init                 Write a starter .agentlintrc.json (refuses to overwrite
                       without --force).
  add <id>             Install a catalog item (skill / MCP server / tool) into
                       the project. `agentlint add --list` lists ids.
```

### Install from the catalog (`agentlint add`)

Browse the catalog on the web (`/catalog`) or from the CLI, then install any item straight into your project — validated by agentlint before it's written:

```bash
agentlint add --list                 # list every skill / MCP server / tool
agentlint add code-reviewer          # → .claude/agents/code-reviewer.md
agentlint add pdf-extract            # → .claude/skills/pdf-extract/SKILL.md
agentlint add mcp-github             # merges the server into .mcp.json
agentlint add mcp-github --dry-run   # preview without writing
```

MCP servers are **merged** into an existing `.mcp.json` (never clobbered); existing files aren't overwritten without `--force`. Every item uses `${ENV_VAR}` references, so no secrets are ever written.

### Exit codes

| Code | Meaning |
| --- | --- |
| `0` | No errors (warnings within `--max-warnings`). |
| `1` | Errors found, or warnings exceeded `--max-warnings`. |
| `2` | Usage error, IO error, or invalid configuration. |

### Configuration

agentlint reads `.agentlintrc.json` from the current directory **upward** (nearest wins). Run `agentlint init` to scaffold one:

```json
{
  "$schema": "https://agentlint.dev/schema/agentlintrc.json",
  "rules": {
    "settings/unknown-key": "off",
    "security/unpinned-mcp-package": "error"
  },
  "ignore": ["node_modules", "dist"]
}
```

- `rules` — per-rule severity override: `"off"`, `"error"`, `"warning"`, or `"info"`.
- `ignore` — gitignore-style patterns applied during file discovery.

## Library usage

The validation engine ships as `agentlint-core` (pure TypeScript, only one runtime dependency: `yaml`). `lintFiles` is pure — no filesystem, network, or code execution — so you can lint in-memory content anywhere:

```ts
import { lintFiles, lintDirectory, rules } from 'agentlint-core';

// Lint pasted / in-memory content (pure, no I/O):
const result = lintFiles([
  { path: '.mcp.json', content: '{"mcpServers": []}' },
]);
console.log(result.summary); // { errors, warnings, infos, filesChecked }
for (const f of result.findings) {
  console.log(`${f.file}:${f.line}:${f.column} ${f.severity} ${f.ruleId} — ${f.message}`);
}

// Or discover and lint a directory from disk:
const dirResult = await lintDirectory(process.cwd());

// The rule catalog (used to build docs / a rules page):
console.log(rules.length); // 58
```

See [packages/core/README.md](./packages/core/README.md) for the full API.

## Web app

There is an optional, self-hostable web validator (`@agentlint/web`, Next.js): paste a config, get instant validation and security checks, browse the rules catalog, and copy vetted templates. It calls the same pure `lintFiles` engine on the server, stores nothing, and ships strict security headers (nonce'd CSP, HSTS, `X-Content-Type-Options`, etc.).

### Run it locally

```bash
npm install                 # once, from the repo root
npm run build -w agentlint-core   # the web app imports the built engine
npm run dev -w @agentlint/web      # http://localhost:3100
```

> Tip: build `agentlint-core` **before** `next dev`/`next build`, and don't run a production `next build` while `next dev` is live on the same checkout — they share `.next/` and a concurrent build can corrupt the dev server's chunks (a `Cannot find module './NNN.js'` 500). If that happens, stop the dev server, `rm -rf apps/web/.next`, and restart `npm run dev`.

### How to use the web validator

1. Open **/** (the Validator). Pick a **File kind** — `CLAUDE.md`, Subagent, Slash command, **Skill (SKILL.md)**, `settings.json`, `.mcp.json`, or cross-tool Instructions — or leave **auto-detect** on.
2. **Paste** your config (or **Upload file**). For a Skill, paste the contents of your `SKILL.md`.
3. Press **Validate**. You get findings grouped by severity, each with `line:col`, the rule id (links to **/rules**), the message, and a **fixable** badge where a safe autofix exists.
4. **/catalog** — find & download vetted **Skills, MCP servers, and Tools** (subagents & slash commands). Live search, filter by kind, copy a snippet, download one, or **download all**. Every item is validated by agentlint (zero errors) and uses `${ENV_VAR}` references, never secrets.
5. **/rules** — browse every check with a bad → good example you can run in one click. **/templates** — copy known-good configs and the curated **Skills** catalog.

Nothing is stored — the server lints in memory and returns JSON. Inputs are size-capped and rate-limited.

### Self-host

Self-host with Docker (non-root image + healthcheck) — see [**docs/DEPLOY.md**](./docs/DEPLOY.md).

## Use it from your agent (MCP)

agentlint ships an **MCP server** so an agent (e.g. Claude Code) can lint its *own* configuration. It's dependency-free — it speaks the MCP stdio protocol directly — and exposes three tools: `lint_config` (lint pasted text), `lint_directory` (lint a folder), and `list_rules`.

```jsonc
// .mcp.json
{
  "mcpServers": {
    "agentlint": { "command": "npx", "args": ["-y", "-p", "agentlint-cli", "agentlint-mcp"] }
  }
}
```

The same server is also a subcommand of the main CLI — `agentlint mcp`. After `npm install -g agentlint-cli` you can run it directly, or point `.mcp.json` at it:

```jsonc
{ "mcpServers": { "agentlint": { "command": "agentlint", "args": ["mcp"] } } }
```

Then ask the agent to "lint my Claude Code config" — it calls agentlint and gets back findings with rule ids, `line:col`, and severities. Like everything in agentlint, it only **parses** your config; it never executes it.

## Use it in CI

The quickest way — the official **GitHub Action** (fails the build on any error):

```yaml
# .github/workflows/agentlint.yml
name: agentlint
on: [push, pull_request]
jobs:
  agentlint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: bacnguyenne/agentlint@v1
        with:
          paths: .            # directories to lint (default ".")
          max-warnings: 5     # optional: fail if warnings exceed this
```

Inputs: `paths`, `max-warnings`, `format` (`stylish`|`json`), `quiet`, `version`. Prefer plain `npx`? That works too:

```yaml
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      # Fail the build on any error; allow up to 5 warnings.
      - run: npx -p agentlint-cli agentlint --max-warnings 5
```

## Quality & trust

agentlint is built to be safe to run on untrusted config (it only parses), and is verified end-to-end:

- `agentlint-core` — 238 unit tests (every rule has triggering + clean fixtures; security rules tested for false positives; ReDoS-pathological inputs; autofix idempotency).
- `agentlint` **CLI** — 47 integration tests running the built binary over fixtures and asserting exit codes + JSON output.
- `@agentlint/web` — 45 unit tests + 13 Playwright end-to-end tests (real Chromium) covering the validator and security-header assertions.
- `npm audit --omit=dev` — 0 production vulnerabilities (2 low-severity advisories remain dev-only, in the ESLint toolchain).
- **Security-audited**, including a fixed prototype-pollution bug in the JSON parser. All regexes are ReDoS-safe and all inputs are size-capped.
- **Docker** image builds, runs as a **non-root** user, and serves with a healthcheck.

## Contributing

Contributions are welcome — especially new rules for misconfigurations you've hit in the wild. See [**CONTRIBUTING.md**](./CONTRIBUTING.md) for dev setup, how to add a rule, and PR expectations, and [**CODE_OF_CONDUCT.md**](./CODE_OF_CONDUCT.md).

To report a security issue, see [**SECURITY.md**](./SECURITY.md).

## License

[MIT](./LICENSE) © 2026 agentlint contributors. Free and open source — no telemetry, no account, no paywall.

## ☕ Support — buy me a coffee

agentlint is a free, non-profit project maintained in spare time. Support is entirely **optional** — the tool is and always will be free, with no accounts, paywall, or telemetry. If it saved you a debugging session, you can scan the VietQR below to send a coffee via bank transfer:

<img src="https://raw.githubusercontent.com/bacnguyenne/agentlint/main/apps/web/public/support-qr.jpg" alt="Buy me a coffee — VietQR" width="220" />**NGUYEN DINH NGUYEN BAC · VietinBank · 109875964393**

Prefer something free? A ⭐ on the repo helps just as much: https://github.com/bacnguyenne/agentlint

Thank you!