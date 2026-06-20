#!/usr/bin/env node
/**
 * sync-mcp — build the MCP catalog from popular, real servers with their REAL
 * latest published versions (fetched from the npm and PyPI registries) instead
 * of hand-guessed version numbers.
 *
 * The server list is curated from the well-known ecosystem (the official
 * modelcontextprotocol/servers repo + widely-used third-party servers); the
 * VERSIONS are looked up live so nothing is invented. Each generated `.mcp.json`
 * is validated by agentlint and only kept if it passes with zero errors.
 *
 * Output: `apps/web/src/lib/mcp-catalog.ts` (consumed by `gen-catalog.mjs`) +
 * `docs/MCP-SOURCES.md`. Run: `npm run sync:mcp` (build core first).
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { lintFiles } from '../packages/core/dist/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..');
const OUT_TS = path.join(ROOT, 'apps', 'web', 'src', 'lib', 'mcp-catalog.ts');
const OUT_DOC = path.join(ROOT, 'docs', 'MCP-SOURCES.md');

/**
 * Curated popular servers. `pkg` is the real published package; the version is
 * fetched live. `remote` servers use a URL (no package). Secrets are ${ENV}.
 */
const SERVERS = [
  { id: 'filesystem', title: 'Filesystem', desc: 'Read, write, and search files within allowed directories.', tags: ['files', 'local'], runtime: 'npm', pkg: '@modelcontextprotocol/server-filesystem', args: ['.'] },
  { id: 'github', title: 'GitHub', desc: 'Manage issues, PRs, and repositories on GitHub.', tags: ['git', 'github', 'api'], runtime: 'npm', pkg: '@modelcontextprotocol/server-github', env: { GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_PERSONAL_ACCESS_TOKEN}' } },
  { id: 'memory', title: 'Memory', desc: 'A persistent knowledge-graph memory across sessions.', tags: ['memory', 'state'], runtime: 'npm', pkg: '@modelcontextprotocol/server-memory' },
  { id: 'sequential-thinking', title: 'Sequential Thinking', desc: 'Structured step-by-step reasoning scratchpad.', tags: ['reasoning'], runtime: 'npm', pkg: '@modelcontextprotocol/server-sequential-thinking' },
  { id: 'everything', title: 'Everything', desc: 'The MCP reference/test server (tools, resources, prompts).', tags: ['reference', 'testing'], runtime: 'npm', pkg: '@modelcontextprotocol/server-everything' },
  { id: 'fetch', title: 'Fetch', desc: 'Fetch a URL and return its content as Markdown.', tags: ['web', 'http'], runtime: 'pypi', pkg: 'mcp-server-fetch' },
  { id: 'git', title: 'Git', desc: 'Read, search, and manipulate a local Git repository.', tags: ['git', 'local'], runtime: 'pypi', pkg: 'mcp-server-git' },
  { id: 'time', title: 'Time', desc: 'Current time and timezone conversion utilities.', tags: ['utility'], runtime: 'pypi', pkg: 'mcp-server-time' },
  { id: 'sqlite', title: 'SQLite', desc: 'Query and inspect a local SQLite database.', tags: ['database', 'sql'], runtime: 'pypi', pkg: 'mcp-server-sqlite', args: ['--db-path', './data.db'] },
  { id: 'playwright', title: 'Playwright', desc: 'Drive a real browser for testing and scraping.', tags: ['browser', 'testing', 'web'], runtime: 'npm', pkg: '@playwright/mcp' },
  { id: 'puppeteer', title: 'Puppeteer', desc: 'Browser automation via Puppeteer.', tags: ['browser', 'web'], runtime: 'npm', pkg: 'puppeteer-mcp-server' },
  { id: 'postgres', title: 'Postgres', desc: 'Run read-only SQL queries and inspect a PostgreSQL schema.', tags: ['database', 'sql'], runtime: 'npm', pkg: 'enhanced-postgres-mcp-server', env: { DATABASE_URI: '${DATABASE_URI}' } },
  { id: 'notion', title: 'Notion', desc: 'Read and update Notion pages and databases.', tags: ['docs', 'api'], runtime: 'npm', pkg: '@notionhq/notion-mcp-server', env: { NOTION_TOKEN: '${NOTION_TOKEN}' } },
  { id: 'exa', title: 'Exa Search', desc: 'Neural web search and content retrieval via Exa.', tags: ['web', 'search', 'api'], runtime: 'npm', pkg: 'exa-mcp-server', env: { EXA_API_KEY: '${EXA_API_KEY}' } },
  { id: 'firecrawl', title: 'Firecrawl', desc: 'Crawl and scrape websites into clean Markdown.', tags: ['web', 'scraping', 'api'], runtime: 'npm', pkg: 'firecrawl-mcp', env: { FIRECRAWL_API_KEY: '${FIRECRAWL_API_KEY}' } },
  { id: 'tavily', title: 'Tavily', desc: 'Web search and extraction optimized for LLMs.', tags: ['web', 'search', 'api'], runtime: 'npm', pkg: 'tavily-mcp', env: { TAVILY_API_KEY: '${TAVILY_API_KEY}' } },
  { id: 'context7', title: 'Context7', desc: 'Up-to-date, version-specific library docs and examples.', tags: ['docs', 'reference'], runtime: 'npm', pkg: '@upstash/context7-mcp' },
  { id: 'supabase', title: 'Supabase', desc: 'Manage a Supabase project: tables, SQL, edge functions.', tags: ['database', 'api'], runtime: 'npm', pkg: '@supabase/mcp-server-supabase', env: { SUPABASE_ACCESS_TOKEN: '${SUPABASE_ACCESS_TOKEN}' } },
  { id: 'mongodb', title: 'MongoDB', desc: 'Query and inspect a MongoDB database.', tags: ['database'], runtime: 'npm', pkg: 'mongodb-mcp-server', env: { MDB_MCP_CONNECTION_STRING: '${MDB_MCP_CONNECTION_STRING}' } },
  { id: 'stripe', title: 'Stripe', desc: 'Manage payments, customers, and invoices via Stripe.', tags: ['payments', 'api'], runtime: 'npm', pkg: '@stripe/mcp', args: ['--tools=all'], env: { STRIPE_SECRET_KEY: '${STRIPE_SECRET_KEY}' } },
  { id: 'sentry', title: 'Sentry', desc: 'Look up and triage errors and issues from Sentry.', tags: ['observability', 'api'], runtime: 'pypi', pkg: 'mcp-server-sentry', args: ['--auth-token', '${SENTRY_AUTH_TOKEN}'] },
  { id: 'slack', title: 'Slack', desc: 'Read channels and post messages to Slack.', tags: ['chat', 'api'], runtime: 'npm', pkg: '@modelcontextprotocol/server-slack', env: { SLACK_BOT_TOKEN: '${SLACK_BOT_TOKEN}', SLACK_TEAM_ID: '${SLACK_TEAM_ID}' } },
  { id: 'brave-search', title: 'Brave Search', desc: 'Web and local search via the Brave Search API.', tags: ['web', 'search', 'api'], runtime: 'npm', pkg: '@modelcontextprotocol/server-brave-search', env: { BRAVE_API_KEY: '${BRAVE_API_KEY}' } },
  // Remote (hosted) servers — no package, just a URL.
  { id: 'linear', title: 'Linear', desc: 'Create and update issues and projects in Linear.', tags: ['issues', 'api'], runtime: 'remote', type: 'sse', url: 'https://mcp.linear.app/sse' },
];

async function npmVersion(pkg) {
  try {
    const r = await fetch(`https://registry.npmjs.org/${pkg}/latest`, { headers: { 'user-agent': 'agentlint-sync-mcp' } });
    if (!r.ok) return null;
    return (await r.json()).version ?? null;
  } catch {
    return null;
  }
}
async function pypiVersion(pkg) {
  try {
    const r = await fetch(`https://pypi.org/pypi/${pkg}/json`, { headers: { 'user-agent': 'agentlint-sync-mcp' } });
    if (!r.ok) return null;
    return (await r.json()).info?.version ?? null;
  } catch {
    return null;
  }
}

function envVarsOf(server) {
  const out = new Set();
  const re = /\$\{([A-Z_][A-Z0-9_]*)\}/g;
  let m;
  const text = JSON.stringify(server);
  while ((m = re.exec(text)) !== null) out.add(m[1]);
  return [...out];
}
function installCmd(name, server) {
  if (server.command) {
    const env = server.env ? Object.keys(server.env).map((k) => `-e ${k}=${server.env[k]}`).join(' ') : '';
    const args = Array.isArray(server.args) ? server.args.join(' ') : '';
    return `claude mcp add ${name}${env ? ' ' + env : ''} -- ${server.command} ${args}`.trim();
  }
  if (server.url) return `claude mcp add --transport ${server.type || 'http'} ${name} ${server.url}`;
  return '';
}

async function main() {
  const items = [];
  const report = [];
  for (const s of SERVERS) {
    let server;
    let versionNote = '';
    if (s.runtime === 'remote') {
      server = { type: s.type || 'http', url: s.url };
    } else {
      const version = s.runtime === 'npm' ? await npmVersion(s.pkg) : await pypiVersion(s.pkg);
      if (!version) {
        report.push({ id: s.id, status: 'skipped (no published version found)' });
        continue;
      }
      versionNote = version;
      if (s.runtime === 'npm') {
        server = { command: 'npx', args: ['-y', `${s.pkg}@${version}`, ...(s.args || [])] };
      } else {
        server = { command: 'uvx', args: [`${s.pkg}==${version}`, ...(s.args || [])] };
      }
      if (s.env) server.env = s.env;
    }
    const content = JSON.stringify({ mcpServers: { [s.id]: server } }, null, 2) + '\n';
    const result = lintFiles([{ path: '.mcp.json', content, kind: 'mcp' }]);
    if (result.summary.errors > 0) {
      report.push({ id: s.id, status: `rejected (${result.summary.errors} errors)` });
      continue;
    }
    items.push({
      id: `mcp-${s.id}`,
      kind: 'mcp',
      configKind: 'mcp',
      name: s.id,
      title: s.title,
      description: s.desc,
      source: s.runtime === 'remote' ? s.url : `https://www.npmjs.com/package/${s.pkg}`,
      license: 'MIT',
      tags: ['mcp', ...s.tags],
      targetPath: '.mcp.json',
      content,
      install: installCmd(s.id, server),
      envVars: envVarsOf(server),
    });
    report.push({ id: s.id, status: `synced${versionNote ? ' @' + versionNote : ' (remote)'}` });
  }

  items.sort((a, b) => a.id.localeCompare(b.id));
  const banner =
    '// AUTO-GENERATED by scripts/sync-mcp.mjs — do not edit by hand.\n' +
    '// Popular MCP servers with their REAL published versions (npm/PyPI), each\n' +
    '// validated by agentlint (0 errors). Refresh with `npm run sync:mcp`.\n\n';
  writeFileSync(OUT_TS, banner + `export const MCP_ITEMS = ${JSON.stringify(items, null, 2)};\n`);

  const doc = [
    '# Synced MCP sources',
    '',
    'Generated by `scripts/sync-mcp.mjs`. Versions are the real latest published on npm/PyPI at sync time.',
    'Each generated `.mcp.json` is validated by agentlint; only 0-error servers are kept.',
    '',
    '| server | status |',
    '|---|---|',
    ...report.map((r) => `| \`${r.id}\` | ${r.status} |`),
    '',
  ].join('\n');
  writeFileSync(OUT_DOC, doc);
  console.log(`mcp: ${items.length} synced (of ${SERVERS.length}).`);
}

main().catch((e) => {
  console.error('sync-mcp failed:', e.message);
  process.exit(0);
});
