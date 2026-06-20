# agentlint-core

[![npm version](https://img.shields.io/npm/v/agentlint-core.svg)](https://www.npmjs.com/package/agentlint-core)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

The validation & security engine behind [**agentlint**](https://github.com/bacnguyenne/agentlint) — it lints AI coding-agent configuration for Claude Code (`CLAUDE.md`, `.claude/agents`, `.claude/commands`, `settings.json`) and MCP (`.mcp.json`), and flags security issues like hardcoded secrets and dangerous hook commands.

Pure TypeScript, dependency-light (only `yaml` at runtime). **Never executes, imports, evals, or network-fetches user content — it only parses.**

> Unofficial — not affiliated with Anthropic.

## Install

```bash
npm install agentlint-core
```

Requires Node.js >= 20. ESM-only.

## Usage

### Lint in-memory content (pure, no I/O)

`lintFiles` performs no filesystem, network, or code-execution side effects — ideal for validating pasted/uploaded content (it's exactly what the web app uses):

```ts
import { lintFiles } from 'agentlint-core';

const result = lintFiles([
  { path: '.mcp.json', content: '{"mcpServers": []}' },
  { path: '.claude/settings.json', content: '{"hooks": []}' },
]);

console.log(result.summary);
// { errors: 2, warnings: 0, infos: 0, filesChecked: 2 }

for (const f of result.findings) {
  console.log(`${f.file}:${f.line}:${f.column} [${f.severity}] ${f.ruleId} — ${f.message}`);
}
```

Each file's `kind` is auto-detected from its `path` when omitted; pass `kind` explicitly to force it.

### Lint a directory (filesystem)

```ts
import { lintDirectory } from 'agentlint-core';

const result = await lintDirectory(process.cwd(), {
  ignore: ['node_modules', 'dist'],
  rules: { 'settings/unknown-key': 'off' },
});
```

`lintDirectory` is the only function in this package that touches the filesystem.

### Apply autofixes

```ts
import { lintFilesWithFixes, lintDirectoryWithFixes } from 'agentlint-core';

const { result, fixedFiles } = lintFilesWithFixes(
  [{ path: '.mcp.json', content: '{"mcpServers": []}' }],
  { fix: true },
);
// fixedFiles: Map<string /* path */, string /* new full content */>
```

### The rule catalog

```ts
import { rules } from 'agentlint-core';

console.log(rules.length); // 42
for (const r of rules) {
  console.log(r.id, r.severity, r.fixable, r.meta.title);
}
```

See the full catalog in [docs/RULES.md](https://github.com/bacnguyenne/agentlint/blob/main/docs/RULES.md).

## API

```ts
// In-memory (pure):
function lintFiles(files: InputFile[], opts?: LintOptions): LintResult;
function lintFilesWithFixes(
  files: InputFile[],
  opts?: LintOptions,
): { result: LintResult; fixedFiles: Map<string, string> };

// Filesystem:
function lintDirectory(dir: string, opts?: LintOptions): Promise<LintResult>;
function lintDirectoryWithFixes(
  dir: string,
  opts?: LintOptions,
): Promise<{ result: LintResult; fixedFiles: Map<string, string> }>;

// Catalog:
const rules: Rule[];
```

### Types

```ts
interface InputFile {
  path: string;
  content: string;
  kind?: FileKind; // 'agent' | 'command' | 'settings' | 'mcp' | 'claudemd' | 'unknown'
}

interface LintOptions {
  fix?: boolean;
  rules?: Record<string, 'off' | 'error' | 'warning' | 'info'>;
  ignore?: string[]; // gitignore-style, applied during directory discovery
  cwd?: string;
}

interface Finding {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  message: string; // secret values are redacted here
  file: string;
  line?: number;   // 1-based
  column?: number; // 1-based
  fixable: boolean;
  docsSlug: string;
}

interface LintResult {
  findings: Finding[];
  summary: { errors: number; warnings: number; infos: number; filesChecked: number };
}
```

Also exported: `Rule`, `RuleContext`, `RuleMeta`, `FileKind`, `Severity`, `ParsedFile`, `ParsedFrontmatter`, `ParsedJson`, `ParseError`, `FixResult`, plus helpers `discoverFiles`, `classifyPath`, `compileIgnore`, `applyFixes`, `parseFrontmatter`, `parseJson`, `slugifyName`, and the constant `MAX_FILE_BYTES`.

## Safety

- No execution, import, eval, or network fetch of user content — parsing only.
- All regexes are ReDoS-safe (bounded); inputs are size-capped (`MAX_FILE_BYTES`).
- Secret values are redacted in finding messages.
- 238 unit tests; `npm audit --omit=dev` reports 0 production vulnerabilities (the only advisories are 2 low-severity, dev-only, in the ESLint toolchain).

## License

[MIT](./LICENSE) © 2026 agentlint contributors.

☕ Support: scan the VietQR in the [main README](https://github.com/bacnguyenne/agentlint#-support--buy-me-a-coffee) · ⭐ Star: https://github.com/bacnguyenne/agentlint
