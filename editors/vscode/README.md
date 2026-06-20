# agentlint for VS Code

Lints your AI coding-agent config (Claude Code, MCP, Cursor, Copilot, AGENTS.md, Windsurf, Cline) in the editor and shows findings as native diagnostics. It shells out to the `agentlint` CLI (`--format json`) so it always matches the engine you run in CI — no separate rule copy.

## How it works
- On startup and on every save (configurable), it runs `agentlint --format json .` in each workspace folder.
- Findings become VS Code diagnostics (squiggles) with the rule id as the code and `agentlint` as the source.
- It only **parses** your files — never executes them.

## Settings
- `agentlint.command` — how to invoke agentlint. Default `npx` (runs `npx -y agentlint`); or set a path to a local `agentlint` binary.
- `agentlint.runOnSave` — re-lint on save (default `true`).

## Develop / build / publish
```bash
cd editors/vscode
npm install            # pulls @types/vscode, esbuild, @vscode/vsce
npm run typecheck      # tsc --noEmit (also runs offline against src/vscode.d.ts)
npm run build          # esbuild bundle -> dist/extension.js
npm run package        # vsce package -> agentlint-vscode-*.vsix
```
Press `F5` in VS Code (with this folder open) to launch an Extension Development Host and try it on a real workspace.

> **Status:** the extension code is type-checked in CI-style here, but a full runtime check requires VS Code (`F5` / installing the `.vsix`). Do that before publishing to the Marketplace.
