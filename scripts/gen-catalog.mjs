#!/usr/bin/env node
/**
 * gen-catalog — build the unified discovery catalog (Skills + MCP servers +
 * Tools) and emit it as a generated TypeScript module into BOTH the web app and
 * the CLI, so they share a single source of truth.
 *
 * Skills are read from `apps/web/src/lib/skill-catalog.ts` (produced by
 * `sync-skills.mjs`). MCP servers and Tools are defined here.
 *
 * Outputs (identical content):
 *   - apps/web/src/lib/catalog.generated.ts   (the web `/catalog` page)
 *   - packages/cli/src/catalog.generated.ts   (the `agentlint add` command)
 *
 * Run: `npm run gen:catalog`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..');
const SKILL_TS = path.join(ROOT, 'apps', 'web', 'src', 'lib', 'skill-catalog.ts');
const OUT_WEB = path.join(ROOT, 'apps', 'web', 'src', 'lib', 'catalog.generated.ts');
const OUT_CLI = path.join(ROOT, 'packages', 'cli', 'src', 'catalog.generated.ts');

/* --------------------------- builders --------------------------- */

function mcpInstallCommand(name, server) {
  if (typeof server.command === 'string') {
    const env = server.env;
    const envFlags = env ? Object.keys(env).map((k) => `-e ${k}=${env[k]}`).join(' ') : '';
    const args = Array.isArray(server.args) ? server.args.join(' ') : '';
    return `claude mcp add ${name}${envFlags ? ' ' + envFlags : ''} -- ${server.command} ${args}`.trim();
  }
  if (typeof server.url === 'string') {
    const type = typeof server.type === 'string' ? server.type : 'http';
    return `claude mcp add --transport ${type} ${name} ${server.url}`;
  }
  return '';
}

const mcp = (id, name, title, description, tags, server) => ({
  id: `mcp-${id}`,
  kind: 'mcp',
  configKind: 'mcp',
  name,
  title,
  description,
  source: 'https://github.com/modelcontextprotocol/servers',
  license: 'MIT',
  tags: ['mcp', ...tags],
  targetPath: '.mcp.json',
  content: JSON.stringify({ mcpServers: { [name]: server } }, null, 2) + '\n',
  install: mcpInstallCommand(name, server),
  envVars: extractEnvVars(server),
});

/** Collect the ${ENV_VAR} names a server references (so users know what to set). */
function extractEnvVars(server) {
  const out = new Set();
  const text = JSON.stringify(server);
  const re = /\$\{([A-Z_][A-Z0-9_]*)\}/g;
  let m;
  while ((m = re.exec(text)) !== null) out.add(m[1]);
  return [...out];
}

const agent = (name, title, description, tags, body, opts) => ({
  id: `tool-agent-${name}`,
  kind: 'tool',
  configKind: 'agent',
  name,
  title,
  description,
  source: 'local',
  license: 'MIT',
  tags: ['tool', 'subagent', ...tags],
  targetPath: `.claude/agents/${name}.md`,
  content: `---\nname: ${name}\ndescription: ${JSON.stringify(description)}\ntools: ${opts.tools}\nmodel: ${opts.model}\n---\n\n${body}\n`,
});

const command = (name, title, description, tags, frontmatter, body) => ({
  id: `tool-cmd-${name}`,
  kind: 'tool',
  configKind: 'command',
  name,
  title,
  description,
  source: 'local',
  license: 'MIT',
  tags: ['tool', 'slash-command', ...tags],
  targetPath: `.claude/commands/${name}.md`,
  content: `---\n${frontmatter}\n---\n\n${body}\n`,
});

// A concrete, multi-step WORKFLOW skill for a specific job.
const skill = (name, title, description, tags, allowedTools, body) => ({
  id: `skill-${name}`,
  kind: 'skill',
  configKind: 'skill',
  name,
  title,
  description,
  source: 'local',
  license: 'MIT',
  tags: ['skill', 'workflow', ...tags],
  targetPath: `.claude/skills/${name}/SKILL.md`,
  // JSON.stringify double-quotes the description so a `: ` inside it can't be
  // misread by YAML as a nested mapping.
  content: `---\nname: ${name}\ndescription: ${JSON.stringify(description)}\nallowed-tools: ${allowedTools}\nlicense: MIT\n---\n\n${body}\n`,
});

/* ----------------------------- data ----------------------------- */

const MCP = [
  mcp('filesystem', 'filesystem', 'Filesystem', 'Read, write, and search files within allowed directories.', ['files', 'local'], { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem@2025.8.21', '.'] }),
  mcp('github', 'github', 'GitHub', 'Manage issues, PRs, and repositories on GitHub.', ['git', 'github', 'api'], { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github@2025.4.8'], env: { GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_PERSONAL_ACCESS_TOKEN}' } }),
  mcp('memory', 'memory', 'Memory', 'A persistent knowledge-graph memory for the agent across sessions.', ['memory', 'state'], { command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory@2025.8.4'] }),
  mcp('sequential-thinking', 'sequential-thinking', 'Sequential Thinking', 'Structured step-by-step reasoning scratchpad.', ['reasoning'], { command: 'npx', args: ['-y', '@modelcontextprotocol/server-sequential-thinking@2025.7.1'] }),
  mcp('fetch', 'fetch', 'Fetch', 'Fetch a URL and return its content as Markdown for the agent.', ['web', 'http'], { command: 'uvx', args: ['mcp-server-fetch==2025.4.7'] }),
  mcp('git', 'git', 'Git', 'Read, search, and manipulate a local Git repository.', ['git', 'local'], { command: 'uvx', args: ['mcp-server-git==2025.7.1'] }),
  mcp('sqlite', 'sqlite', 'SQLite', 'Query and inspect a local SQLite database.', ['database', 'sql'], { command: 'uvx', args: ['mcp-server-sqlite==2025.4.7', '--db-path', './data.db'] }),
  mcp('playwright', 'playwright', 'Playwright', 'Drive a real browser for end-to-end testing and scraping.', ['browser', 'testing', 'web'], { command: 'npx', args: ['-y', '@playwright/mcp@0.0.41'] }),
  mcp('slack', 'slack', 'Slack', 'Read channels and post messages to a Slack workspace.', ['chat', 'api'], { command: 'npx', args: ['-y', '@modelcontextprotocol/server-slack@2025.4.8'], env: { SLACK_BOT_TOKEN: '${SLACK_BOT_TOKEN}', SLACK_TEAM_ID: '${SLACK_TEAM_ID}' } }),
  mcp('postgres', 'postgres', 'Postgres', 'Run read-only SQL queries and inspect a PostgreSQL schema.', ['database', 'sql'], { command: 'npx', args: ['-y', '@modelcontextprotocol/server-postgres@2025.4.8', '${DATABASE_URL}'] }),
  mcp('brave-search', 'brave-search', 'Brave Search', 'Web and local search via the Brave Search API.', ['web', 'search', 'api'], { command: 'npx', args: ['-y', '@modelcontextprotocol/server-brave-search@2025.4.8'], env: { BRAVE_API_KEY: '${BRAVE_API_KEY}' } }),
  mcp('notion', 'notion', 'Notion', 'Read and update Notion pages and databases.', ['docs', 'api'], { command: 'npx', args: ['-y', '@notionhq/notion-mcp-server@1.9.0'], env: { NOTION_TOKEN: '${NOTION_TOKEN}' } }),
  mcp('sentry', 'sentry', 'Sentry', 'Look up and triage errors and issues from Sentry.', ['observability', 'api'], { command: 'uvx', args: ['mcp-server-sentry==2025.4.7', '--auth-token', '${SENTRY_AUTH_TOKEN}'] }),
  mcp('gitlab', 'gitlab', 'GitLab', 'Manage GitLab projects, issues, and merge requests.', ['git', 'api'], { command: 'npx', args: ['-y', '@modelcontextprotocol/server-gitlab@2025.4.8'], env: { GITLAB_PERSONAL_ACCESS_TOKEN: '${GITLAB_PERSONAL_ACCESS_TOKEN}', GITLAB_API_URL: '${GITLAB_API_URL}' } }),
  mcp('google-maps', 'google-maps', 'Google Maps', 'Geocoding, directions, and place search via Google Maps.', ['maps', 'api'], { command: 'npx', args: ['-y', '@modelcontextprotocol/server-google-maps@2025.4.8'], env: { GOOGLE_MAPS_API_KEY: '${GOOGLE_MAPS_API_KEY}' } }),
  mcp('time', 'time', 'Time', 'Current time and timezone conversion utilities.', ['utility'], { command: 'uvx', args: ['mcp-server-time==2025.7.1'] }),
  mcp('everything', 'everything', 'Everything', 'The MCP reference/test server exercising tools, resources, and prompts.', ['reference', 'testing'], { command: 'npx', args: ['-y', '@modelcontextprotocol/server-everything@2025.8.18'] }),
  mcp('gdrive', 'gdrive', 'Google Drive', 'Search and read files from Google Drive.', ['files', 'google', 'api'], { command: 'npx', args: ['-y', '@modelcontextprotocol/server-gdrive@2025.1.14'], env: { GDRIVE_CREDENTIALS_PATH: '${GDRIVE_CREDENTIALS_PATH}' } }),
  mcp('redis', 'redis', 'Redis', 'Read and write keys in a Redis datastore.', ['database', 'cache'], { command: 'npx', args: ['-y', '@modelcontextprotocol/server-redis@2025.4.25', '${REDIS_URL}'] }),
  mcp('exa', 'exa', 'Exa Search', 'Neural web search and content retrieval via the Exa API.', ['web', 'search', 'api'], { command: 'npx', args: ['-y', 'exa-mcp-server@2.0.5'], env: { EXA_API_KEY: '${EXA_API_KEY}' } }),
  mcp('firecrawl', 'firecrawl', 'Firecrawl', 'Crawl and scrape websites into clean Markdown via Firecrawl.', ['web', 'scraping', 'api'], { command: 'npx', args: ['-y', 'firecrawl-mcp@1.12.0'], env: { FIRECRAWL_API_KEY: '${FIRECRAWL_API_KEY}' } }),
  mcp('tavily', 'tavily', 'Tavily', 'Web search and extraction optimized for LLMs via Tavily.', ['web', 'search', 'api'], { command: 'npx', args: ['-y', 'tavily-mcp@0.2.9'], env: { TAVILY_API_KEY: '${TAVILY_API_KEY}' } }),
  mcp('context7', 'context7', 'Context7', 'Up-to-date, version-specific docs and code examples for libraries.', ['docs', 'reference'], { command: 'npx', args: ['-y', '@upstash/context7-mcp@1.0.14'] }),
  mcp('perplexity', 'perplexity', 'Perplexity', 'Ask Perplexity for web-grounded answers with citations.', ['web', 'search', 'api'], { command: 'npx', args: ['-y', 'server-perplexity-ask@0.1.3'], env: { PERPLEXITY_API_KEY: '${PERPLEXITY_API_KEY}' } }),
  mcp('stripe', 'stripe', 'Stripe', 'Manage payments, customers, and invoices via the Stripe API.', ['payments', 'api'], { command: 'npx', args: ['-y', '@stripe/mcp@0.2.3', '--tools=all'], env: { STRIPE_SECRET_KEY: '${STRIPE_SECRET_KEY}' } }),
  mcp('linear', 'linear', 'Linear', 'Create and update issues and projects in Linear.', ['issues', 'api'], { command: 'npx', args: ['-y', 'mcp-remote@0.1.9', 'https://mcp.linear.app/sse'] }),
  mcp('supabase', 'supabase', 'Supabase', 'Manage a Supabase project: tables, SQL, and edge functions.', ['database', 'api'], { command: 'npx', args: ['-y', '@supabase/mcp-server-supabase@0.4.5'], env: { SUPABASE_ACCESS_TOKEN: '${SUPABASE_ACCESS_TOKEN}' } }),
  mcp('mongodb', 'mongodb', 'MongoDB', 'Query and inspect a MongoDB database.', ['database'], { command: 'npx', args: ['-y', 'mongodb-mcp-server@0.4.0'], env: { MDB_MCP_CONNECTION_STRING: '${MDB_MCP_CONNECTION_STRING}' } }),
  mcp('figma', 'figma', 'Figma', 'Read Figma files and translate designs into code context.', ['design', 'api'], { command: 'npx', args: ['-y', 'figma-developer-mcp@0.4.2', '--stdio'], env: { FIGMA_API_KEY: '${FIGMA_API_KEY}' } }),
  mcp('obsidian', 'obsidian', 'Obsidian', 'Read and search notes in an Obsidian vault.', ['notes', 'docs'], { command: 'uvx', args: ['mcp-obsidian==0.2.0'], env: { OBSIDIAN_API_KEY: '${OBSIDIAN_API_KEY}', OBSIDIAN_HOST: '${OBSIDIAN_HOST}' } }),
  mcp('cloudflare', 'cloudflare', 'Cloudflare', 'Manage Workers, KV, R2, and D1 on Cloudflare.', ['cloud', 'api'], { command: 'npx', args: ['-y', '@cloudflare/mcp-server-cloudflare@0.1.4'], env: { CLOUDFLARE_API_TOKEN: '${CLOUDFLARE_API_TOKEN}' } }),
];

const TOOLS = [
  agent('code-reviewer', 'Code reviewer', 'Reviews staged changes for bugs, security issues, and missing tests. Use proactively before every commit or PR.', ['review', 'quality'],
    `You are a meticulous senior code reviewer.\n\nWhen invoked:\n1. Run \`git diff --staged\` to see what changed.\n2. Flag correctness bugs, security issues, and missing tests first; style last.\n3. Group findings by severity, cite file:line, and keep each point concrete.\n\nReport findings only — never modify files yourself.`,
    { tools: 'Read, Grep, Glob, Bash', model: 'sonnet' }),
  agent('test-author', 'Test author', 'Writes focused unit tests for changed code. Use after implementing a feature or fixing a bug.', ['testing', 'tdd'],
    `You write tests, not implementation.\n\n1. Read the changed code and its existing tests.\n2. Add tests for the happy path, edge cases, and regressions.\n3. Keep tests deterministic and fast; run them and report the results.`,
    { tools: 'Read, Edit, Bash', model: 'sonnet' }),
  agent('debugger', 'Debugger', 'Roots out the cause of a failing test or runtime error. Use when something is broken and the cause is unclear.', ['debugging'],
    `You find root causes, not symptoms.\n\n1. Reproduce the failure and read the exact error and stack trace.\n2. Form a hypothesis, add the smallest probe to confirm it, then fix the cause.\n3. Re-run to prove the fix and check nothing else regressed.`,
    { tools: 'Read, Edit, Bash, Grep', model: 'sonnet' }),
  agent('security-auditor', 'Security auditor', 'Audits changes for injection, authz gaps, and unsafe secret handling. Use before merging auth or input-handling code.', ['security'],
    `You are a security auditor. For the changes in scope:\n\n1. Check input validation, authentication/authorization, and secret handling.\n2. Flag injection, SSRF, path traversal, and unsafe deserialization.\n3. Report each issue with file:line, a severity, and a concrete fix.\n\nReport findings only — never modify code yourself.`,
    { tools: 'Read, Grep, Glob', model: 'opus' }),
  agent('docs-writer', 'Docs writer', 'Writes and updates README and reference docs from the code. Use after a feature lands or an API changes.', ['docs'],
    `You write clear, accurate documentation grounded in the code.\n\n1. Read the public surface (exports, routes, flags) before writing.\n2. Lead with how to use it; keep examples runnable.\n3. Never document behavior you have not verified in the source.`,
    { tools: 'Read, Edit, Glob', model: 'sonnet' }),
  agent('planner', 'Planner', 'Turns a feature request into a concrete, step-by-step implementation plan. Use before writing code for anything non-trivial.', ['planning'],
    `You plan, you do not implement.\n\n1. Restate the goal and list the unknowns; read the code to resolve them.\n2. Produce an ordered plan: files to touch, the change in each, and the build order.\n3. Call out risks, edge cases, and how each step will be verified.`,
    { tools: 'Read, Grep, Glob', model: 'opus' }),
  agent('refactorer', 'Refactorer', 'Simplifies and de-duplicates code without changing behavior. Use after a feature works but reads poorly.', ['refactor', 'quality'],
    `You improve clarity while preserving behavior.\n\n1. Identify duplication, dead code, and overly complex logic.\n2. Make the smallest change that improves readability; keep public APIs stable.\n3. Run the tests after each change to prove behavior is unchanged.`,
    { tools: 'Read, Edit, Bash, Grep', model: 'sonnet' }),
  agent('perf-optimizer', 'Performance optimizer', 'Finds and fixes performance bottlenecks with measurements, not guesses. Use when something is measurably slow.', ['performance'],
    `You optimize based on evidence.\n\n1. Reproduce and measure the slow path before changing anything.\n2. Fix the biggest measured bottleneck first; avoid speculative micro-optimizations.\n3. Re-measure to prove the win and confirm no correctness regression.`,
    { tools: 'Read, Edit, Bash, Grep', model: 'sonnet' }),
  command('commit', '/commit', 'Drafts a Conventional Commits message from the staged diff and commits.', ['git'],
    'description: Stage-aware commit — drafts a conventional-commit message from the staged diff.\nallowed-tools: Bash(git add:*), Bash(git commit:*), Bash(git status:*), Bash(git diff:*)',
    `Review the staged changes and write a concise Conventional Commits message, then commit.\n\nStaged summary:\n!\`git diff --staged --stat\``),
  command('review', '/review', 'Reviews the current diff for bugs, security, and missing tests.', ['review'],
    'description: Review the working changes for bugs, security issues, and missing tests.\nallowed-tools: Bash(git diff:*), Read, Grep',
    `Review the changes below. Report correctness bugs and security issues first, then missing tests, then style. Cite file:line.\n\nDiff:\n!\`git diff\``),
  command('test', '/test', 'Runs the test suite and summarizes failures with likely causes.', ['testing'],
    'description: Run the project test suite and summarize failures.\nallowed-tools: Bash(npm test:*), Bash(npm run test:*)',
    `Run the test suite, then summarize each failure with the file, the assertion, and the most likely cause.`),
  command('plan', '/plan', 'Drafts a step-by-step implementation plan for a feature before any code is written.', ['planning'],
    'description: Draft an implementation plan for the described feature.\nargument-hint: [feature]',
    `Produce an ordered implementation plan for: $ARGUMENTS\n\nList the files to touch, the change in each, the build order, and how each step is verified. Do not write code yet.`),
  command('pr', '/pr', 'Drafts a pull-request title and description from the branch diff.', ['git'],
    'description: Draft a PR title and description from the current branch.\nallowed-tools: Bash(git log:*), Bash(git diff:*)',
    `Summarize the changes on this branch into a PR title and a concise description (what changed and why, plus test notes).\n\nBranch diff:\n!\`git diff main...HEAD --stat\``),
  agent('api-designer', 'API designer', 'Designs REST and RPC API surfaces — resources, status codes, pagination, versioning, and error shapes. Use when adding or changing an API.', ['api', 'design'],
    `You design clear, consistent API surfaces.\n\n1. Model the resources and their relationships before endpoints.\n2. Use correct status codes, consistent error shapes, and explicit pagination/filtering.\n3. Plan for versioning and backward compatibility from the start.`,
    { tools: 'Read, Grep, Glob', model: 'sonnet' }),
  agent('accessibility-auditor', 'Accessibility auditor', 'Audits UI for WCAG issues — semantics, labels, contrast, focus, and keyboard support. Use when building or reviewing UI components.', ['a11y', 'frontend', 'review'],
    `You audit interfaces for accessibility.\n\n1. Check semantic structure, ARIA, and form labels.\n2. Verify keyboard operability and a visible focus order.\n3. Flag contrast and motion issues. Cite the WCAG criterion for each finding.`,
    { tools: 'Read, Grep, Glob', model: 'sonnet' }),
  agent('sql-optimizer', 'SQL optimizer', 'Finds and fixes slow SQL — missing indexes, N+1s, and bad plans. Use when a query or migration is slow or under review.', ['database', 'performance'],
    `You make queries fast and safe.\n\n1. Read the query and the schema; get the actual plan (EXPLAIN).\n2. Fix the biggest cost first: indexes, joins, or query shape.\n3. Re-check the plan and confirm correctness and row counts are unchanged.`,
    { tools: 'Read, Grep, Bash(psql:*)', model: 'sonnet' }),
  agent('dependency-auditor', 'Dependency auditor', 'Reviews dependencies for vulnerabilities, license risk, and bloat. Use before adding a dependency or during a security pass.', ['security', 'dependencies'],
    `You vet dependencies.\n\n1. Run the audit tooling and read each advisory.\n2. Assess license compatibility and maintenance health.\n3. Recommend pin, upgrade, replace, or remove — with the reason for each.`,
    { tools: 'Read, Grep, Bash(npm audit:*)', model: 'sonnet' }),
  command('scaffold', '/scaffold', 'Scaffolds a new module/component following the repo conventions.', ['development'],
    'description: Scaffold a new module or component that matches existing conventions.\nargument-hint: [name]',
    `Scaffold "$ARGUMENTS". First read two similar existing files to match structure, naming, and tests, then create the new files the same way.`),
  command('explain', '/explain', 'Explains how a file or feature works, with a call map.', ['understanding'],
    'description: Explain how the given file or feature works.\nargument-hint: [path-or-feature]\nallowed-tools: Read, Grep, Glob',
    `Explain "$ARGUMENTS": its responsibility, key functions, the data flow, and how it connects to the rest of the codebase. Cite file:line.`),
  command('fix-ci', '/fix-ci', 'Diagnoses a red CI run and proposes the minimal fix.', ['ci', 'debugging'],
    'description: Diagnose the failing CI job and propose the minimal fix.\nallowed-tools: Read, Grep, Bash(npm test:*), Bash(npm run:*)',
    `Read the failing CI output, identify the first real failure (not downstream noise), and propose the smallest change that makes it green.`),
];

// Concrete, end-to-end workflow skills — each does ONE specific job in steps.
const WORKFLOW_SKILLS = [
  skill(
    'ship-feature',
    'Ship a feature',
    'Plan, implement, test, and open a PR for a feature end to end. Use when starting a non-trivial feature, change request, or ticket.',
    ['development', 'planning'],
    'Read, Edit, Grep, Glob, Bash(git:*), Bash(npm test:*), Bash(npm run:*)',
    `# Ship a feature

A disciplined, end-to-end workflow for delivering a feature.

## When to use
Starting any non-trivial feature, ticket, or change request.

## Steps
1. **Understand** — restate the goal in one sentence. Read the relevant code and existing tests before writing anything.
2. **Plan** — list the files to touch and the change in each; identify edge cases and the build order.
3. **Implement** — make the smallest changes that satisfy the plan. Keep public APIs stable unless the task requires otherwise.
4. **Test** — add tests for the happy path, edge cases, and regressions. Run the suite and make it green.
5. **Self-review** — re-read your diff for correctness, security, and missing tests. Run \`git diff\`.
6. **PR** — write a clear title and description (what changed and why, plus test notes), then open the pull request.

## Guardrails
- Never commit secrets; use environment variables.
- If the plan changes mid-way, update it before continuing.`,
  ),
  skill(
    'review-pr',
    'Review a pull request',
    'Run a thorough pull-request review covering correctness, security, tests, and style. Use when reviewing a PR or a diff before merge.',
    ['review', 'security', 'quality'],
    'Read, Grep, Glob, Bash(git diff:*), Bash(git log:*)',
    `# Review a pull request

## When to use
Reviewing a PR or a working diff before it merges.

## Steps
1. **Context** — read the PR description and the list of changed files. \`git diff <base>...HEAD\`.
2. **Correctness** — trace the logic; look for off-by-one, null/undefined, error handling, and race conditions.
3. **Security** — check input validation, authz, secret handling, injection, SSRF, and unsafe deserialization.
4. **Tests** — confirm new behavior is covered and the tests would actually fail without the change.
5. **Style** — flag only what matters: naming, dead code, and inconsistency with the surrounding code.

## Output
Group findings by severity (blocker / should-fix / nit). Cite \`file:line\` and give a concrete fix for each. Approve only when blockers are resolved.`,
  ),
  skill(
    'cut-release',
    'Cut a release',
    'Cut a release: bump the version, update the changelog, tag, and draft release notes. Use when preparing a release or a version bump.',
    ['release', 'git'],
    'Read, Edit, Bash(git log:*), Bash(git tag:*), Bash(npm version:*)',
    `# Cut a release

## When to use
Preparing a release or a version bump.

## Steps
1. **Collect changes** — \`git log <last-tag>..HEAD\`. Group commits into Added / Changed / Fixed.
2. **Choose the version** — semver: breaking → major, feature → minor, fix → patch.
3. **Changelog** — write a dated entry at the top of CHANGELOG.md; one line per user-facing change.
4. **Bump** — update the version in package metadata.
5. **Tag** — create an annotated tag for the version.
6. **Release notes** — draft concise notes (highlights, breaking changes, upgrade steps).

## Guardrails
- Never release with a red build. Run the full test suite first.
- Pin/verify any publish credentials come from the environment.`,
  ),
  skill(
    'debug-failing-test',
    'Debug a failing test',
    'Find and fix the root cause of a failing test or red CI job. Use when a test or build is failing and the cause is unclear.',
    ['debugging', 'testing'],
    'Read, Edit, Grep, Bash(npm test:*), Bash(git bisect:*)',
    `# Debug a failing test

## When to use
A test or CI job is red and the cause is not obvious.

## Steps
1. **Reproduce** — run the single failing test locally and read the exact error and stack trace.
2. **Localize** — is it the test or the code? Check recent changes; \`git bisect\` if it regressed.
3. **Hypothesize** — form one concrete hypothesis about the cause.
4. **Probe** — add the smallest assertion or log that confirms or refutes it.
5. **Fix the cause** — not the symptom. Avoid weakening the test to make it pass.
6. **Verify** — re-run the test and the surrounding suite to confirm no new breakage.

## Guardrails
- A flaky test is a bug — fix the race or timing, don't add retries blindly.`,
  ),
  skill(
    'triage-incident',
    'Triage a production incident',
    'Triage a production incident: assess impact, mitigate, find root cause, and write a postmortem. Use when responding to an outage or a production bug.',
    ['incident', 'ops', 'security'],
    'Read, Grep, Glob, Bash(git log:*)',
    `# Triage a production incident

## When to use
Responding to an outage, regression, or production bug.

## Steps
1. **Assess** — what is broken, for whom, and how badly? Establish severity and a timeline.
2. **Mitigate first** — stop the bleeding (roll back, feature-flag off, scale) before root-causing.
3. **Diagnose** — correlate the start of the incident with recent deploys/changes; read logs and metrics.
4. **Root cause** — identify the actual cause, not the trigger.
5. **Fix forward** — land and verify the real fix.
6. **Postmortem** — write a blameless summary: impact, timeline, root cause, and concrete prevention items.

## Guardrails
- Communicate status early and often. Never paste secrets or customer data into the postmortem.`,
  ),
  skill(
    'upgrade-dependencies',
    'Upgrade dependencies safely',
    'Safely upgrade project dependencies and verify nothing broke. Use when bumping dependencies or addressing a security advisory.',
    ['dependencies', 'security', 'maintenance'],
    'Read, Edit, Bash(npm outdated:*), Bash(npm audit:*), Bash(npm test:*)',
    `# Upgrade dependencies safely

## When to use
Bumping dependencies, or responding to a security advisory.

## Steps
1. **Survey** — \`npm outdated\` and \`npm audit\` to see what is out of date or vulnerable.
2. **Prioritize** — security fixes first, then patch/minor, then major (one at a time).
3. **Upgrade incrementally** — bump one package (or one group), then run the full test suite.
4. **Read changelogs** for any major bump; handle breaking changes deliberately.
5. **Verify** — tests green, the app builds and runs, and \`npm audit\` is clean for production deps.

## Guardrails
- Never blanket-upgrade everything at once — a single green run won't tell you which bump broke things.
- Pin versions; avoid floating ranges for anything security-sensitive.`,
  ),

  // ---- Coding workflows: plan -> implement -> validate -> production ----
  skill(
    'plan-to-production',
    'Code from plan to production',
    'The full coding workflow: turn a requirement into production-ready, validated code. Use at the start of any non-trivial coding task you intend to ship.',
    ['coding', 'planning', 'production'],
    'Read, Edit, Grep, Glob, Bash(git:*), Bash(npm test:*), Bash(npm run:*)',
    `# Code from plan to production

A senior-engineer workflow that takes one requirement all the way to shippable code. Do the phases in order; do not skip validation.

## 0. Understand
State the goal in one sentence and the acceptance criteria. Read the relevant code, tests, and conventions first. List unknowns and resolve them before designing.

## 1. Plan
Write a short plan: the files to touch and the change in each, the data flow, edge cases, and the build order. Identify the riskiest part and how you'll de-risk it. Keep public APIs stable unless the task requires otherwise.

## 2. Implement
Make the smallest changes that satisfy the plan. Follow the surrounding code's style and patterns. Read secrets from the environment — never hardcode them.

## 3. Validate (do not skip)
- **Tests**: cover the happy path, edge cases, and a regression for any bug.
- **Run it**: build and exercise the real path, not just unit tests.
- **Self-review**: re-read the full \`git diff\` for correctness, security, and missing tests.
- **Lint/format**: run the project's linters and \`npx agentlint\` if it touches agent config.

## 4. Harden for production
Error handling on every fallible call · input validation at trust boundaries · logging/observability for the new path · config via env · performance acceptable under realistic load · a rollback/feature-flag plan.

## 5. Ship
Write a clear PR (what changed and why, plus test notes). Ensure CI is green before merge.

## Definition of done
Behavior matches the acceptance criteria · tests prove it · it handles failure and bad input · it's observable and reversible · the diff is clean and reviewed.`,
  ),
  skill(
    'tdd',
    'Test-driven development',
    'Drive implementation with tests: red, green, refactor. Use when implementing a feature or fixing a bug and you want tests to shape the design.',
    ['coding', 'testing', 'tdd'],
    'Read, Edit, Bash(npm test:*), Bash(npm run:*)',
    `# Test-driven development (red → green → refactor)

## When to use
Implementing a feature or fixing a bug, test-first.

## The loop
1. **Red** — write ONE small failing test that states the next desired behavior. Run it; confirm it fails for the right reason.
2. **Green** — write the minimum code to make it pass. Resist adding untested behavior.
3. **Refactor** — clean up names, duplication, and structure with the tests green. Re-run after each change.
4. Repeat for the next behavior. Commit at green points.

## For a bug
First write a test that REPRODUCES the bug (red), then fix the cause (green). The test guards against regressions forever.

## Guardrails
- One behavior per test; keep tests deterministic and fast.
- Never weaken a test to make it pass — fix the code.`,
  ),
  skill(
    'production-readiness',
    'Make code production-ready',
    "Take working code from 'it runs on my machine' to production-ready. Use before shipping a feature, or after a prototype works.",
    ['coding', 'production', 'reliability'],
    'Read, Edit, Grep, Bash(npm test:*), Bash(npm audit:*)',
    `# Production-readiness checklist

Working code is not shippable code. Walk this checklist before production.

## Correctness & tests
- Meaningful tests for the happy path, edge cases, and known failure modes.
- No skipped/focused tests left behind; the suite is green and reasonably fast.

## Failure handling
- Every I/O, network, and parse call handles errors explicitly — no silently swallowed failures.
- Timeouts and retries (with backoff) on remote calls; idempotency where it matters.

## Security
- Input validated/sanitized at trust boundaries; queries parameterized.
- Secrets from environment, never committed. AuthZ checks on every protected path.
- \`npm audit\` clean for production deps.

## Observability
- Structured logs for the new path (no secrets/PII in logs); useful error messages; metrics where it matters.

## Operability
- Config via environment; sensible defaults. A rollback or feature-flag plan. Docs/README updated.

## Performance
- Acceptable under realistic load; no obvious N+1s or unbounded work.`,
  ),
  skill(
    'api-endpoint',
    'Design & build an API endpoint',
    'Design and build a REST/RPC endpoint from requirements to a tested, documented route. Use when adding or changing an API.',
    ['coding', 'api', 'backend'],
    'Read, Edit, Grep, Glob, Bash(npm test:*)',
    `# Design & build an API endpoint

## When to use
Adding or changing an API.

## Steps
1. **Model** — identify the resource(s) and the operation; pick the right method and path. Resources are nouns; avoid verbs in paths.
2. **Contract** — define request/response shapes, the success status code, the error shape (consistent across the API), pagination/filtering, and versioning/back-compat.
3. **Validate** — validate and coerce input at the boundary; reject unknown fields; never trust the client.
4. **Implement** — keep the handler thin; put logic in a service layer. Return correct status codes (201 for create, 204 for no content, 4xx for client errors).
5. **Secure** — authn/authz, rate limits, and no sensitive data in responses or logs.
6. **Test** — happy path, validation failures, authz failures, and edge cases.
7. **Document** — update the OpenAPI/schema and an example request/response.

## Guardrails
- Errors are structured and actionable, never a raw stack trace.
- A change to an existing endpoint must stay backward compatible or be versioned.`,
  ),
  skill(
    'secure-coding',
    'Write & review secure code',
    'Write and review code for security: input validation, authorization, secrets, injection, SSRF. Use when handling user input, authentication, or sensitive data.',
    ['coding', 'security'],
    'Read, Edit, Grep, Glob',
    `# Secure coding

## When to use
Handling user input, authentication/authorization, or sensitive data.

## Checklist
1. **Trust boundaries** — validate and sanitize all external input (body, query, headers, files). Reject by default; allowlist over denylist.
2. **Injection** — parameterize SQL; avoid building shell/HTML/queries by string concatenation. Escape on output.
3. **AuthN/AuthZ** — verify identity AND permission on every protected action; never rely on the client. Check object-level ownership.
4. **Secrets** — from environment only; never log them or commit them. Rotate on exposure.
5. **SSRF / path traversal** — validate URLs and file paths; restrict outbound requests; resolve and confine paths.
6. **Deserialization & uploads** — don't deserialize untrusted data into types; validate file type/size.

## Verify
Test the abuse cases, not just the happy path: malformed input, missing auth, wrong user, oversized payloads.`,
  ),
  skill(
    'optimize-performance',
    'Profile & optimize a slow path',
    'Profile and optimize a slow code path with measurements, not guesses. Use when something is measurably slow.',
    ['coding', 'performance'],
    'Read, Edit, Grep, Bash(npm test:*), Bash(npm run:*)',
    `# Profile & optimize

## When to use
Something is measurably slow (a request, a query, a build, a job).

## Steps
1. **Measure first** — reproduce the slow path and get a real number (timing, profiler, query plan). Never optimize on a hunch.
2. **Find the bottleneck** — the biggest cost, not the most obvious code. Look for N+1 queries, unbounded loops, missing indexes, repeated work, and blocking I/O.
3. **Fix the biggest one** — algorithmic and I/O wins first; micro-optimizations last.
4. **Re-measure** — prove the win with the same measurement. Confirm correctness is unchanged.
5. **Guard it** — add a benchmark or budget so the regression can't return silently.

## Guardrails
- One change at a time, measured. Don't trade correctness for speed.`,
  ),
  skill(
    'database-migration',
    'Ship a safe database migration',
    'Write and ship a safe, reversible database migration with zero-downtime in mind. Use when changing a database schema.',
    ['coding', 'database', 'production'],
    'Read, Edit, Bash(psql:*)',
    `# Safe database migration

## When to use
Changing a database schema in a deployed system.

## Principles
1. **Additive first** — add columns/tables/indexes before using them; never drop or rename in the same deploy that stops using them.
2. **Backfill safely** — backfill in batches; avoid long locks. Add indexes concurrently where supported.
3. **Expand → migrate → contract** — deploy the schema change, then the code that uses it, and only later remove the old column/path once nothing reads it.
4. **Reversible** — write both up and down; test the down migration.
5. **Order of deploy** — schema, then code; ensure the old code still works against the new schema during the rollout.

## Verify
Run up and down on a copy; check lock behavior on a realistic data size; confirm the app works mid-rollout (old code + new schema).`,
  ),
];

/** Extract the TOOL_ITEMS array from the synced tools-catalog.ts (if present). */
function readTools() {
  try {
    const ts = readFileSync(path.join(ROOT, 'apps', 'web', 'src', 'lib', 'tools-catalog.ts'), 'utf8');
    // The array is JSON emitted by sync-tools; slice from its opening `[` to the
    // file's last `]` (robust against `];` appearing inside item content).
    const marker = ts.indexOf('TOOL_ITEMS');
    const start = ts.indexOf('[', marker);
    const end = ts.lastIndexOf(']');
    if (marker < 0 || start < 0 || end < start) return [];
    return JSON.parse(ts.slice(start, end + 1));
  } catch {
    return [];
  }
}

/** Extract the MCP_ITEMS array from the synced mcp-catalog.ts (if present). */
function readMcp() {
  try {
    const ts = readFileSync(path.join(ROOT, 'apps', 'web', 'src', 'lib', 'mcp-catalog.ts'), 'utf8');
    const marker = ts.indexOf('MCP_ITEMS');
    const start = ts.indexOf('[', marker);
    const end = ts.lastIndexOf(']');
    if (marker < 0 || start < 0 || end < start) return [];
    return JSON.parse(ts.slice(start, end + 1));
  } catch {
    return [];
  }
}

/** Extract the SKILL_CATALOG array from the generated skill-catalog.ts. */
function readSkills() {
  const ts = readFileSync(SKILL_TS, 'utf8');
  const m = ts.match(/export const SKILL_CATALOG: CuratedSkill\[\] = (\[[\s\S]*?\]);/);
  if (!m) return [];
  return JSON.parse(m[1]).map((s) => ({
    id: `skill-${s.id}`,
    kind: 'skill',
    configKind: 'skill',
    name: s.name,
    title: s.title,
    description: s.description,
    source: s.source,
    license: s.license,
    tags: ['skill'],
    targetPath: `.claude/skills/${s.name}/SKILL.md`,
    content: s.content,
  }));
}

// Prefer REAL tools synced from a hot repo (wshobson/agents); fall back to the
// hand-authored set only when the sync hasn't run (offline / fresh checkout).
const syncedTools = readTools();
const syncedMcp = readMcp();
const items = [
  ...readSkills(),
  ...WORKFLOW_SKILLS,
  ...(syncedMcp.length > 0 ? syncedMcp : MCP),
  ...(syncedTools.length > 0 ? syncedTools : TOOLS),
];

const banner =
  '// AUTO-GENERATED by scripts/gen-catalog.mjs — do not edit by hand.\n' +
  '// The unified discovery catalog (Skills + MCP servers + Tools). Run: npm run gen:catalog\n\n';
const body = `export const CATALOG_ITEMS = ${JSON.stringify(items, null, 2)};\n`;

writeFileSync(OUT_WEB, banner + body);
writeFileSync(OUT_CLI, banner + body);
const n = (k) => items.filter((i) => i.kind === k).length;
console.log(`catalog: ${items.length} items (${n('skill')} skills, ${n('mcp')} mcp, ${n('tool')} tools) -> web + cli`);
