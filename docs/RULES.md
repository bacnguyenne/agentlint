# Rule catalog

agentlint ships **58 rules** across the groups below. This catalog is generated from `agentlint-core`'s `rules` export by `scripts/gen-rules.mjs` (run `npm run gen:rules`), so it stays in lockstep with the engine.

- Severities: **error** (causes CLI exit code 1), **warning**, **info**.
- **Fix** = a safe autofix is available (apply with `agentlint --fix`).
- Override any rule's severity in `.agentlintrc.json` via `{ "rules": { "<id>": "off|error|warning|info" } }`.

Totals: 27 errors, 26 warnings, 5 infos · 10 fixable.

## Core (engine)

| Rule id | Severity | Fix | Applies to | Description |
|---|---|:---:|---|---|
| `core/file-too-large` | warning | — | agent, command, settings, mcp, claudemd, unknown | The file exceeds agentlint’s per-file size cap (1 MiB) and is skipped to avoid excessive memory use. Split or trim the file so it can be linted. |

## Agent — `.claude/agents/*.md`

| Rule id | Severity | Fix | Applies to | Description |
|---|---|:---:|---|---|
| `agent/missing-frontmatter` | error | — | agent | A subagent file must begin with a `--- ... ---` YAML frontmatter block declaring at least `name` and `description`. |
| `agent/missing-name` | error | — | agent | The `name` field is required and is how the subagent is referenced. |
| `agent/invalid-name` | error | ✅ | agent | The `name` must match `^[a-z][a-z0-9-]*$` (lowercase letters, digits, hyphens). |
| `agent/name-filename-mismatch` | warning | ✅ | agent | By convention the `name` should equal the file basename so the agent is easy to locate. |
| `agent/missing-description` | error | — | agent | The `description` drives auto-delegation and is required. |
| `agent/unknown-tool` | warning | — | agent | The `tools` list should only contain known Claude Code tools or `mcp__*` server tools. |
| `agent/invalid-model` | error | ✅ | agent | The `model` must be one of inherit\|opus\|sonnet\|haiku or a valid claude-* id without a -latest suffix. |
| `agent/empty-body` | error | — | agent | The Markdown body after the frontmatter is the system prompt and must be non-empty. |

## Command — `.claude/commands/**/*.md`

| Rule id | Severity | Fix | Applies to | Description |
|---|---|:---:|---|---|
| `command/invalid-frontmatter` | error | — | command | The optional YAML frontmatter block contains a syntax error. |
| `command/unknown-key` | warning | — | command | Only description, argument-hint, allowed-tools, model, disable-model-invocation are recognized. |
| `command/empty-body` | error | — | command | A slash command must have a non-empty body (the prompt template). |
| `command/invalid-model` | warning | ✅ | command | The `model` must be opus\|sonnet\|haiku\|default or a valid claude-* id without -latest. |
| `command/unknown-allowed-tool` | warning | — | command | Each `allowed-tools` entry should be a known Claude Code tool (optionally with a `(...)` qualifier) or an `mcp__*` tool. |

## Skill — `.claude/skills/<name>/SKILL.md`

| Rule id | Severity | Fix | Applies to | Description |
|---|---|:---:|---|---|
| `skill/missing-frontmatter` | error | — | skill | A SKILL.md must begin with a `--- ... ---` YAML frontmatter block declaring at least `name` and `description`. |
| `skill/invalid-frontmatter` | error | — | skill | The YAML frontmatter block contains a syntax error. |
| `skill/filename-not-canonical` | error | — | skill | Claude Code only loads a skill from a case-sensitive `SKILL.md`. A file like `skill.md` or `Skill.md` is silently ignored. |
| `skill/missing-name` | error | — | skill | The `name` field is required and should match the skill directory name. |
| `skill/invalid-name` | error | ✅ | skill | The `name` must match `^[a-z][a-z0-9-]*$` (lowercase letters, digits, hyphens) and be at most 64 characters. |
| `skill/name-dir-mismatch` | warning | ✅ | skill | The `name` must equal the parent skill directory name, or Claude Code may not discover the skill correctly. |
| `skill/missing-description` | error | — | skill | The `description` is required; it is how Claude decides when to load the skill. |
| `skill/description-too-long` | warning | — | skill | The `description` should be at most 1024 characters; longer text is truncated for discovery and wastes context. |
| `skill/description-missing-trigger` | info | — | skill | A good description states WHAT the skill does AND WHEN to use it (e.g. "Use when…"). Without a trigger phrase Claude may not load the skill at the right time. |
| `skill/unknown-key` | warning | — | skill | Only name, description, license, compatibility, metadata, allowed-tools, version, author, model, argument-hint, user-invocable, disable-model-invocation, context, effort, when_to_use, hooks are recognized. A typo here (e.g. `allowed_tools`) is silently ignored. |
| `skill/metadata-reserved-key` | info | — | skill | `version`, `author`, and `license` should be top-level frontmatter keys; nesting them under `metadata` can break marketplace validators that only read them at the top level. |
| `skill/invalid-model` | warning | — | skill | When present, `model` must be one of inherit\|opus\|sonnet\|haiku or a pinned claude-* id (no -latest). |
| `skill/unknown-allowed-tool` | warning | — | skill | Each `allowed-tools` entry should be a known Claude Code tool (optionally with a `(...)` qualifier) or an `mcp__*` tool. |
| `skill/broad-allowed-tools` | warning | — | skill | An `allowed-tools` entry of "*", "Bash", or "Bash(*)" pre-approves unrestricted shell access. Scope it (e.g. Bash(git status:*)). |
| `skill/empty-body` | error | — | skill | The Markdown body after the frontmatter holds the skill instructions and must be non-empty. |

## Settings — `.claude/settings.json`, `settings.local.json`

| Rule id | Severity | Fix | Applies to | Description |
|---|---|:---:|---|---|
| `settings/invalid-json` | error | — | settings | The settings file must be strict JSON. |
| `settings/hooks-not-object` | error | ✅ | settings | Legacy/flat array hooks are not supported; `hooks` must be an object keyed by event name. |
| `settings/hook-matcher-not-string` | error | ✅ | settings | A hook `matcher` is a regex string over the tool name (or omitted), not an object like {toolName}. |
| `settings/hook-matcher-invalid-regex` | warning | — | settings | A hook `matcher` is a regex over the tool name; an invalid pattern silently never matches, so the hook never fires. |
| `settings/hooks-unknown-event` | warning | — | settings | Valid events: PreToolUse, PostToolUse, UserPromptSubmit, Stop, SubagentStop, Notification, SessionStart, SessionEnd, PreCompact. |
| `settings/hook-missing-command` | error | — | settings | Each hook handler must be `{ "type": "command", "command": "<shell>" }`. |
| `settings/invalid-model` | warning | ✅ | settings | Use opus\|sonnet\|haiku\|default or a pinned claude-* id (no -latest). |
| `settings/unknown-key` | info | — | settings | A top-level key is not a recognized setting. |

## MCP — `.mcp.json`

| Rule id | Severity | Fix | Applies to | Description |
|---|---|:---:|---|---|
| `mcp/invalid-json` | error | — | mcp | The MCP config must be strict JSON. |
| `mcp/missing-mcpservers` | error | — | mcp | The top-level `mcpServers` object is required. |
| `mcp/mcpservers-is-array` | error | ✅ | mcp | `mcpServers` is an array; it must be an object keyed by server name. |
| `mcp/server-missing-endpoint` | error | — | mcp | Each server must define either a `command` (stdio) or a `url` (remote). |
| `mcp/invalid-transport` | warning | — | mcp | A remote server `type` must be "http" or "sse"; stdio servers omit `type`. |
| `mcp/unknown-server-key` | info | — | mcp | Recognized keys: command, args, env, type, url, headers. |
| `mcp/invalid-server-name` | warning | — | mcp | A server name becomes the `mcp__<name>__tool` prefix; it must be referenceable, so only letters, digits, `_` and `-` are safe. |
| `mcp/invalid-env-value` | warning | — | mcp | MCP `env` values must be strings; numbers/booleans/objects are invalid, and an empty value for a secret-named key is almost certainly a mistake. |

## CLAUDE.md — `CLAUDE.md` (and nested)

| Rule id | Severity | Fix | Applies to | Description |
|---|---|:---:|---|---|
| `claudemd/empty` | warning | — | claudemd | An empty CLAUDE.md provides no project guidance to the agent. |
| `claudemd/too-large` | warning | — | claudemd | A very large CLAUDE.md consumes context budget on every request; consider trimming or splitting it. |

## Security — cross-cutting

| Rule id | Severity | Fix | Applies to | Description |
|---|---|:---:|---|---|
| `security/hardcoded-secret` | error | — | mcp, settings, claudemd, command, agent, skill, instructions | A literal API key/token/password was found. Use a `${ENV_VAR}` reference instead of committing the secret. |
| `security/dangerous-hook-command` | error | — | settings | A hook runs automatically; destructive or privilege-escalating commands are flagged. |
| `security/remote-code-execution` | error | — | settings, mcp, command, agent, skill, claudemd, instructions | Piping a downloaded script directly into a shell executes untrusted code; pin and review instead. |
| `security/suspicious-instruction` | warning | — | claudemd, agent, command, skill, instructions | A directive telling the agent to ignore its instructions, hide actions from the user, or exfiltrate secrets is a hallmark of a malicious skill or instruction file. Review it. |
| `security/mcp-http-no-auth` | warning | — | mcp | A remote (http/sse) MCP server without an Authorization/auth header may be unauthenticated. |
| `security/broad-permissions` | warning | — | settings | Wildcard allows like "*", "Bash(*)", or bare "Bash" grant the agent unrestricted power. |
| `security/unpinned-mcp-package` | info | — | mcp | Running npx/uvx without an @version pulls the latest package each run — a supply-chain risk. |
| `security/secret-named-env-plaintext` | warning | — | settings, mcp | A secret-looking key (token/api_key/password/…) has a literal value; use a `${ENV_VAR}` reference. |
| `security/mcp-insecure-url` | warning | — | mcp | A remote MCP endpoint reached over plaintext http:// transmits any auth header in the clear. Use https:// — localhost/loopback is exempt. |
| `security/permission-allow-deny-conflict` | warning | — | settings | A rule listed in both permissions.allow and permissions.deny is contradictory; deny always wins, so the allow entry is dead and misleading. |
| `security/permissions-bypass-mode` | error | — | settings | defaultMode "bypassPermissions" lets the agent run ANY command with no confirmation — the single most dangerous setting to commit. |

---

For the precise schemas these rules enforce (subagent frontmatter, slash-command keys, the Agent Skill `SKILL.md` shape, the hooks shape, `.mcp.json` server shapes, secret patterns), see [SPEC.md](./SPEC.md).

> Unofficial — not affiliated with Anthropic.
