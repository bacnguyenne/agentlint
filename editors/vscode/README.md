# agentcheck for VS Code

Lints your AI coding-agent config (Claude Code, MCP, Cursor, Copilot, AGENTS.md, Windsurf, Cline) in the editor and shows findings as native diagnostics. It shells out to the `agentcheck` CLI (`--format json`) so it always matches the engine you run in CI — no separate rule copy.

## How it works
- On startup and on every save (configurable), it runs `agentcheck --format json .` in each workspace folder.
- Findings become VS Code diagnostics (squiggles) with the rule id as the code and `agentcheck` as the source.
- It only **parses** your files — never executes them.

## Settings
- `agentcheck.command` — how to invoke agentcheck. Default `npx` (runs `npx -y agentcheck`); or set a path to a local `agentcheck` binary.
- `agentcheck.runOnSave` — re-lint on save (default `true`).

## Develop / build / publish
```bash
cd editors/vscode
npm install            # pulls @types/vscode, esbuild, @vscode/vsce
npm run typecheck      # tsc --noEmit (also runs offline against src/vscode.d.ts)
npm run build          # esbuild bundle -> dist/extension.js
npm run package        # vsce package -> agentcheck-vscode-*.vsix
```
Press `F5` in VS Code (with this folder open) to launch an Extension Development Host and try it on a real workspace.

> **Status:** the extension code is type-checked in CI-style here, but a full runtime check requires VS Code (`F5` / installing the `.vsix`). Do that before publishing to the Marketplace.
