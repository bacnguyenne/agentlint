#!/usr/bin/env node
/**
 * Generate docs/RULES.md from agentlint-core's `rules` export so the published
 * catalog never drifts from the engine (rule count, severities, fixability and
 * descriptions all come straight from the code).
 *
 * Usage: `npm run gen:rules` (build core first). To check it is up to date in
 * CI, run it then `git diff --exit-code docs/RULES.md`.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { rules } from '../packages/core/dist/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'docs', 'RULES.md');

/** Ordered group headings, matched to rule-id prefixes. */
const GROUPS = [
  { prefix: 'core/', heading: 'Core (engine)' },
  { prefix: 'agent/', heading: 'Agent — `.claude/agents/*.md`' },
  { prefix: 'command/', heading: 'Command — `.claude/commands/**/*.md`' },
  { prefix: 'skill/', heading: 'Skill — `.claude/skills/<name>/SKILL.md`' },
  { prefix: 'settings/', heading: 'Settings — `.claude/settings.json`, `settings.local.json`' },
  { prefix: 'mcp/', heading: 'MCP — `.mcp.json`' },
  { prefix: 'claudemd/', heading: 'CLAUDE.md — `CLAUDE.md` (and nested)' },
  { prefix: 'security/', heading: 'Security — cross-cutting' },
];

const esc = (s) => String(s).replace(/\|/g, '\\|');
const fixMark = (f) => (f ? '✅' : '—');

let errors = 0;
let warnings = 0;
let infos = 0;
let fixable = 0;
for (const r of rules) {
  if (r.severity === 'error') errors++;
  else if (r.severity === 'warning') warnings++;
  else infos++;
  if (r.fixable) fixable++;
}

const lines = [];
lines.push('# Rule catalog', '');
lines.push(
  `agentlint ships **${rules.length} rules** across the groups below. This catalog is generated from \`agentlint-core\`'s \`rules\` export by \`scripts/gen-rules.mjs\` (run \`npm run gen:rules\`), so it stays in lockstep with the engine.`,
  '',
);
lines.push('- Severities: **error** (causes CLI exit code 1), **warning**, **info**.');
lines.push('- **Fix** = a safe autofix is available (apply with `agentlint --fix`).');
lines.push(
  "- Override any rule's severity in `.agentlintrc.json` via `{ \"rules\": { \"<id>\": \"off|error|warning|info\" } }`.",
  '',
);
lines.push(`Totals: ${errors} errors, ${warnings} warnings, ${infos} infos · ${fixable} fixable.`, '');

for (const g of GROUPS) {
  const groupRules = rules.filter((r) => r.id.startsWith(g.prefix));
  if (groupRules.length === 0) continue;
  lines.push(`## ${g.heading}`, '');
  lines.push('| Rule id | Severity | Fix | Applies to | Description |');
  lines.push('|---|---|:---:|---|---|');
  for (const r of groupRules) {
    lines.push(
      `| \`${r.id}\` | ${r.severity} | ${fixMark(r.fixable)} | ${r.appliesTo.join(', ')} | ${esc(r.meta.description)} |`,
    );
  }
  lines.push('');
}

lines.push('---', '');
lines.push(
  'For the precise schemas these rules enforce (subagent frontmatter, slash-command keys, the Agent Skill `SKILL.md` shape, the hooks shape, `.mcp.json` server shapes, secret patterns), see [SPEC.md](./SPEC.md).',
  '',
);
lines.push('> Unofficial — not affiliated with Anthropic.', '');

writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${path.relative(process.cwd(), OUT)} (${rules.length} rules)`);
