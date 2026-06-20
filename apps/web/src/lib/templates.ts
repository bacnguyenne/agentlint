import type { SelectableKind } from './detect-kind';

/**
 * Vetted, CORRECT config snippets for the templates gallery. These must pass
 * agentlint cleanly (no errors/warnings) — verified in templates.test.ts by
 * running lintFiles over each one.
 */
export interface Template {
  id: string;
  title: string;
  description: string;
  kind: SelectableKind;
  filename: string;
  content: string;
}

export const TEMPLATES: Template[] = [
  {
    id: 'claudemd',
    title: 'A solid CLAUDE.md',
    description: 'Concise project memory: conventions, commands, and guardrails.',
    kind: 'claudemd',
    filename: 'CLAUDE.md',
    content: `# Project: acme-api

## Stack
- Node 22, TypeScript (strict, ESM), Fastify, Postgres via Prisma.

## Commands
- Install: \`npm ci\`
- Dev: \`npm run dev\`
- Test: \`npm test\` (vitest). Run before every commit.
- Lint/format: \`npm run lint\` and \`npm run format\`.

## Conventions
- Prefer pure functions; keep side effects at the edges.
- All new code needs tests. No \`any\` without a written reason.
- Never commit secrets; use \`.env\` and \`process.env\`.

## Out of scope for the agent
- Do not run database migrations against production.
- Do not edit files under \`vendor/\`.
`,
  },
  {
    id: 'agent',
    title: 'A reviewer subagent',
    description: 'Valid frontmatter (name, description, scoped tools) plus a body.',
    kind: 'agent',
    filename: '.claude/agents/code-reviewer.md',
    content: `---
name: code-reviewer
description: Reviews staged changes for bugs, security issues, and style. Use proactively before commits.
tools: Read, Grep, Glob, Bash
model: sonnet
---

You are a meticulous senior code reviewer.

When invoked:
1. Run \`git diff --staged\` to see the changes.
2. Flag correctness bugs, security issues, and missing tests first.
3. Group feedback by severity. Cite file and line. Be concise and specific.

Never modify files yourself — report findings only.
`,
  },
  {
    id: 'command',
    title: 'A slash command',
    description: 'Optional frontmatter with allowed-tools and an argument hint.',
    kind: 'command',
    filename: '.claude/commands/changelog.md',
    content: `---
description: Draft a changelog entry from recent commits.
argument-hint: [version]
allowed-tools: Bash(git log:*), Read
---

Summarize the commits since the last tag into a changelog for version $1.

Recent history:
!\`git log --oneline -n 30\`

Group entries under Added / Changed / Fixed. Keep it terse.
`,
  },
  {
    id: 'settings',
    title: 'settings.json with hooks',
    description: 'Event-keyed hooks object, string matcher, scoped permissions.',
    kind: 'settings',
    filename: '.claude/settings.json',
    content: `{
  "model": "sonnet",
  "includeCoAuthoredBy": true,
  "permissions": {
    "allow": ["Read", "Edit", "Bash(npm test:*)", "Bash(git status)"],
    "deny": ["Bash(rm:*)"]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "npm run format", "timeout": 60 }
        ]
      }
    ]
  }
}
`,
  },
  {
    id: 'mcp',
    title: '.mcp.json server map',
    description: 'Object-keyed servers, pinned package, env-var auth (no secrets).',
    kind: 'mcp',
    filename: '.mcp.json',
    content: `{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem@2025.1.14", "./"]
    },
    "internal-api": {
      "type": "http",
      "url": "https://mcp.internal.example.com",
      "headers": { "Authorization": "\${INTERNAL_MCP_TOKEN}" }
    }
  }
}
`,
  },
  {
    id: 'instructions-agents',
    title: 'AGENTS.md (cross-tool)',
    description: 'Portable agent instructions read by Cursor, Copilot, Codex & more — no secrets, no RCE.',
    kind: 'instructions',
    filename: 'AGENTS.md',
    content: `# AGENTS.md

## Stack
- Go 1.23, chi router, sqlc + Postgres.

## Build & test
- Build: \`make build\`
- Test: \`go test ./...\` — run before opening a PR.

## Conventions
- Wrap errors with %w; never panic in request handlers.
- Keep handlers thin; put logic in the service layer.
- Read secrets from the environment — never hardcode them.
`,
  },
  {
    id: 'agent-security-auditor',
    title: 'A security-auditor subagent',
    description: 'Read-only auditor with scoped tools — finds issues, never edits code.',
    kind: 'agent',
    filename: '.claude/agents/security-auditor.md',
    content: `---
name: security-auditor
description: Audits changes for security issues — injection, authz gaps, unsafe secret handling. Use before merging auth or input-handling code.
tools: Read, Grep, Glob
model: opus
---

You are a security auditor. For the changes in scope:
1. Check input validation, authentication/authorization, and secret handling.
2. Flag injection, SSRF, path traversal, and unsafe deserialization.
3. Report each issue with file:line, a severity, and a concrete fix.

Report findings only — never modify code yourself.
`,
  },
  {
    id: 'agent-test-author',
    title: 'A test-author subagent',
    description: 'Writes focused tests for changed code; runs them and reports.',
    kind: 'agent',
    filename: '.claude/agents/test-author.md',
    content: `---
name: test-author
description: Writes focused unit tests for changed code. Use after implementing a feature or fixing a bug.
tools: Read, Edit, Bash
model: sonnet
---

You write tests, not implementation.
1. Read the changed code and its existing tests.
2. Add tests for the happy path, edge cases, and regressions.
3. Keep tests deterministic and fast; run them and report results.
`,
  },
  {
    id: 'command-commit',
    title: 'A /commit slash command',
    description: 'Scoped git tools + a dynamic diff; drafts a conventional-commit message.',
    kind: 'command',
    filename: '.claude/commands/commit.md',
    content: `---
description: Stage-aware commit — drafts a conventional-commit message from the staged diff.
allowed-tools: Bash(git add:*), Bash(git commit:*), Bash(git status:*), Bash(git diff:*)
---

Review the staged changes and write a concise conventional-commit message, then commit.

Staged summary:
!\`git diff --staged --stat\`
`,
  },
  {
    id: 'skill-pdf-extract',
    title: 'A PDF-extract skill (SKILL.md)',
    description: 'Valid Agent Skill: name matches the directory, a "Use when…" description, scoped tools.',
    kind: 'skill',
    filename: '.claude/skills/pdf-extract/SKILL.md',
    content: `---
name: pdf-extract
description: Extract text and tables from PDF files and fill PDF forms. Use when the user mentions PDFs, extracting document data, or filling forms.
license: MIT
allowed-tools: Read, Bash(python3:*)
---

# PDF Extract

Extract text and tabular data from PDFs, and fill simple AcroForm fields.

## How to use

1. Confirm the target file is a PDF.
2. Extract text with \`pdfplumber\`:
   \`\`\`python
   import pdfplumber
   with pdfplumber.open("document.pdf") as pdf:
       text = pdf.pages[0].extract_text()
   \`\`\`
3. For tables, use \`page.extract_tables()\`.

For form filling and edge cases, see [references/FORMS.md](references/FORMS.md).
`,
  },
  {
    id: 'skill-conventional-commits',
    title: 'A conventional-commits skill (SKILL.md)',
    description: 'Scoped git tools, top-level version/license, a discovery-friendly description.',
    kind: 'skill',
    filename: '.claude/skills/conventional-commits/SKILL.md',
    content: `---
name: conventional-commits
description: Draft Conventional Commits messages from a staged diff. Use when committing changes or when the user asks for a commit message.
license: MIT
version: "1.0.0"
allowed-tools: Bash(git diff:*), Bash(git status:*)
---

# Conventional Commits

Write a single Conventional Commits message for the staged changes.

## Process

1. Read the staged diff: \`git diff --staged\`.
2. Pick a type: \`feat\`, \`fix\`, \`docs\`, \`refactor\`, \`test\`, \`chore\`.
3. Write \`type(scope): summary\` in the imperative mood, ≤ 72 chars.
4. Add a body only when the change needs rationale.

Never include secrets or file dumps in the message.
`,
  },
];
