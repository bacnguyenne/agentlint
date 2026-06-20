# agentlint

[![npm version](https://img.shields.io/npm/v/agentlint-cli.svg)](https://www.npmjs.com/package/agentlint-cli)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**Lint & security-check your AI coding-agent configuration** — Claude Code (`CLAUDE.md`, `.claude/agents`, `.claude/commands`, `.claude/skills/**/SKILL.md`, `settings.json` / `settings.local.json`) and MCP (`.mcp.json`). CI-friendly, `--fix`, JSON output. It only parses your files — it never executes, imports, or fetches them.

> Unofficial — not affiliated with Anthropic. The npm package is **`agentlint-cli`**; it installs the `agentlint` and `agentlint-mcp` commands.

**▶ Try the live validator (no install):** **https://bacnguyenne.id.vn/agentlint/** — paste a config and lint it in your browser.

## Quick start

```bash
# Lint the current directory (no install needed)
npx -p agentlint-cli agentlint

# Apply safe autofixes and write them back
npx -p agentlint-cli agentlint --fix
```

Or install it globally:

```bash
npm install -g agentlint-cli   # or: npm install -D agentlint-cli
```

After installing you get the `agentlint` and `agentlint-mcp` commands. Requires Node.js >= 20.

## Example output

Secrets are **redacted** in the output:

```text
$ agentlint
.claude/settings.json
   4:15  warning  Overly broad permission "*" in permissions.allow; scope it.        security/broad-permissions
   7:23  error    Hardcoded OpenAI API key detected (sk-proj-***). Use ${ENV_VAR}.    security/hardcoded-secret
  12:20  error    Hook matcher under "PreToolUse" must be a string, not object.       settings/hook-matcher-not-string (fixable)
  13:51  error    Hook command contains a dangerous operation (rm -rf).               security/dangerous-hook-command

.mcp.json
  2:17  error  `mcpServers` is an array; it must be an object keyed by server name.   mcp/mcpservers-is-array (fixable)

✖ 4 errors, 1 warning (2 fixable)
```

## Usage

```text
Usage:
  agentlint [options] [paths...]
  agentlint init [--force]
  agentlint add <id> [--force] [--dry-run]
  agentlint add --list
  agentlint mcp

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
                       the project. Use "agentlint add --list" to see all ids.
  mcp                  Run the agentlint MCP server (stdio) so an agent can lint
                       its own config. Same as the "agentlint-mcp" binary.
```

`--format json` emits a stable, machine-readable object: `{ findings: [...], summary: { errors, warnings, infos, filesChecked } }` (plus `fixed` when `--fix` is used).

## Exit codes

| Code | Meaning |
|---|---|
| `0` | No errors (warnings within `--max-warnings`). |
| `1` | Errors found, or warnings exceeded `--max-warnings`. |
| `2` | Usage error, IO error, or invalid configuration. |

## Configuration

agentlint loads `.agentlintrc.json` from the current directory **upward** (nearest wins). Scaffold one with `agentlint init`:

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

- `rules` — per-rule severity override: `"off" | "error" | "warning" | "info"`.
- `ignore` — gitignore-style patterns applied during discovery.

## Install from the catalog (`agentlint add`)

agentlint bundles a **catalog of 198 vetted items** — 104 Skills, 24 MCP servers, and 70 Tools (subagents & slash commands), each validated by agentlint with zero errors. Install any of them straight into your project:

```bash
agentlint add --list                 # list every skill / MCP server / tool
agentlint add pdf-extract            # → .claude/skills/pdf-extract/SKILL.md
agentlint add plan-to-production     # a coding-workflow skill
agentlint add mcp-filesystem         # merged into ./.mcp.json
```

MCP servers are **merged** into an existing `.mcp.json` (never clobbered); existing files aren't overwritten without `--force`. Every item uses `${ENV_VAR}` references, so no secrets are ever written.

## MCP server (`agentlint mcp`)

Let an agent lint its **own** config. `agentlint mcp` (or the `agentlint-mcp` bin) speaks the MCP stdio protocol directly and exposes `lint_config`, `lint_directory`, and `list_rules`:

```jsonc
// .mcp.json
{ "mcpServers": { "agentlint": { "command": "agentlint", "args": ["mcp"] } } }
```

## In CI (GitHub Actions)

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
- run: npx -p agentlint-cli agentlint --max-warnings 5
```

## Rules

agentlint ships **58 rules** across eight groups — core / agent / command / skill / settings / mcp / claudemd / security. See the full catalog with severity, fixability, and descriptions in [docs/RULES.md](https://github.com/bacnguyenne/agentlint/blob/main/docs/RULES.md).

## License

[MIT](./LICENSE) © 2026 agentlint contributors.

☕ Support: scan the VietQR in the [main README](https://github.com/bacnguyenne/agentlint#-support--buy-me-a-coffee) · ⭐ Star: https://github.com/bacnguyenne/agentlint
