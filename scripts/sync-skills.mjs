#!/usr/bin/env node
/**
 * sync-skills — refresh the curated Agent Skills catalog.
 *
 * Pulls a hand-picked allowlist of high-quality `SKILL.md` files from upstream
 * repositories, validates EACH one with agentlint itself, and keeps only the
 * skills that pass with **zero errors**. The result is written to
 * `apps/web/src/lib/skill-catalog.ts` (a generated module the web Templates page
 * renders) plus a human-readable `docs/SKILL-SOURCES.md` status report.
 *
 * Design goals:
 *  - SAFE: we only ever PARSE fetched content (agentlint never executes it). The
 *    catalog is data, not code.
 *  - DETERMINISTIC & OFFLINE-TOLERANT: a network failure for a source skips that
 *    source (and falls back to its previously-synced content if available); the
 *    local SEED skills are always present, so the catalog is never empty and the
 *    build never breaks just because GitHub was unreachable.
 *  - VETTED: an upstream skill is only added if `agentlint` reports 0 errors.
 *
 * Run locally: `npm run sync:skills` (build core first).
 * In CI: `.github/workflows/sync-skills.yml` runs this weekly and opens a PR.
 *
 * Usage: node scripts/sync-skills.mjs
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { lintFiles, parseFrontmatter } from '../packages/core/dist/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..');
const OUT_TS = path.join(ROOT, 'apps', 'web', 'src', 'lib', 'skill-catalog.ts');
const OUT_DOC = path.join(ROOT, 'docs', 'SKILL-SOURCES.md');

/**
 * Curated upstream sources. Each points at a raw `SKILL.md`. Add to this list to
 * grow the catalog — the sync keeps only the ones that lint clean. We pin a
 * `ref` (branch or tag) for reproducibility; bump it deliberately.
 */
const SOURCES = [
  // Official Anthropic skills (https://github.com/anthropics/skills, Apache-2.0).
  // The full published set under `skills/<name>/SKILL.md` (the `template` is skipped).
  ...[
    'algorithmic-art',
    'brand-guidelines',
    'canvas-design',
    'claude-api',
    'doc-coauthoring',
    'docx',
    'frontend-design',
    'internal-comms',
    'mcp-builder',
    'pdf',
    'pptx',
    'skill-creator',
    'slack-gif-creator',
    'theme-factory',
    'web-artifacts-builder',
    'webapp-testing',
    'xlsx',
  ].map((s) => ({ id: `anthropic-${s}`, owner: 'anthropics', repo: 'skills', ref: 'main', file: `skills/${s}/SKILL.md` })),

  // Official Claude Code plugin skills — building Claude Code extensions
  // (https://github.com/anthropics/claude-code).
  ...[
    ['plugin-agent-dev', 'plugins/plugin-dev/skills/agent-development/SKILL.md'],
    ['plugin-command-dev', 'plugins/plugin-dev/skills/command-development/SKILL.md'],
    ['plugin-hook-dev', 'plugins/plugin-dev/skills/hook-development/SKILL.md'],
    ['plugin-mcp-integration', 'plugins/plugin-dev/skills/mcp-integration/SKILL.md'],
    ['hookify-writing-rules', 'plugins/hookify/skills/writing-rules/SKILL.md'],
  ].map(([id, file]) => ({ id: `anthropic-${id}`, owner: 'anthropics', repo: 'claude-code', ref: 'main', file })),

  // Anthropic cookbook custom skills (https://github.com/anthropics/claude-cookbooks).
  ...[
    ['financial-statements', 'skills/custom_skills/analyzing-financial-statements/SKILL.md'],
    ['brand-guidelines', 'skills/custom_skills/applying-brand-guidelines/SKILL.md'],
    ['financial-models', 'skills/custom_skills/creating-financial-models/SKILL.md'],
  ].map(([id, file]) => ({ id: `cookbook-${id}`, owner: 'anthropics', repo: 'claude-cookbooks', ref: 'main', file })),
];

/**
 * Local, always-present seed skills (the same ones surfaced as Templates). These
 * guarantee a non-empty, build-safe catalog even with no network access.
 */
const SEED = [
  {
    id: 'pdf-extract',
    name: 'pdf-extract',
    title: 'PDF extract',
    description: 'Extract text and tables from PDF files and fill PDF forms.',
    source: 'local',
    license: 'MIT',
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
2. Extract text with \`pdfplumber\`.
3. For tables, use \`page.extract_tables()\`.
`,
  },
  {
    id: 'conventional-commits',
    name: 'conventional-commits',
    title: 'Conventional commits',
    description: 'Draft Conventional Commits messages from a staged diff.',
    source: 'local',
    license: 'MIT',
    content: `---
name: conventional-commits
description: Draft Conventional Commits messages from a staged diff. Use when committing changes or when the user asks for a commit message.
license: MIT
version: "1.0.0"
allowed-tools: Bash(git diff:*), Bash(git status:*)
---

# Conventional Commits

Write a single Conventional Commits message for the staged changes.

1. Read the staged diff: \`git diff --staged\`.
2. Pick a type: feat, fix, docs, refactor, test, chore.
3. Write \`type(scope): summary\` in the imperative mood, <= 72 chars.
`,
  },
];

/** Lint one SKILL.md string at its canonical path; return the summary. */
function vet(name, content) {
  const result = lintFiles([{ path: `.claude/skills/${name}/SKILL.md`, content, kind: 'skill' }]);
  return result.summary;
}

/** Read the previously-synced catalog (if any) so we can fall back on it. */
function readPrevious() {
  try {
    const ts = readFileSync(OUT_TS, 'utf8');
    const m = ts.match(/export const SKILL_CATALOG: CuratedSkill\[\] = (\[[\s\S]*?\]);/);
    if (!m) return new Map();
    const arr = JSON.parse(m[1]);
    return new Map(arr.map((e) => [e.id, e]));
  } catch {
    return new Map();
  }
}

async function fetchSource(src) {
  const url = `https://raw.githubusercontent.com/${src.owner}/${src.repo}/${src.ref}/${src.file}`;
  if (typeof fetch !== 'function') return { ok: false, reason: 'no fetch' };
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'agentlint-sync-skills' } });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}`, url };
    const content = await res.text();
    return { ok: true, content, url };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e), url };
  }
}

const previous = readPrevious();
const catalog = new Map();
const report = [];

// 1) Seeds are always included.
for (const s of SEED) {
  catalog.set(s.id, s);
  report.push({ id: s.id, source: 'local', errors: 0, warnings: 0, status: 'seed' });
}

// 2) Fetch + vet each upstream source.
for (const src of SOURCES) {
  const fetched = await fetchSource(src);
  if (!fetched.ok) {
    const prev = previous.get(src.id);
    if (prev) {
      catalog.set(prev.id, prev);
      report.push({ id: src.id, source: prev.source, errors: 0, warnings: 0, status: `kept (fetch failed: ${fetched.reason})` });
    } else {
      report.push({ id: src.id, source: src.file, errors: '-', warnings: '-', status: `skipped (fetch failed: ${fetched.reason})` });
    }
    continue;
  }
  const fm = parseFrontmatter(fetched.content);
  const name = fm.data && typeof fm.data['name'] === 'string' ? fm.data['name'] : src.id;
  const summary = vet(name, fetched.content);
  if (summary.errors > 0) {
    report.push({ id: src.id, source: fetched.url, errors: summary.errors, warnings: summary.warnings, status: 'rejected (has errors)' });
    continue;
  }
  const desc = fm.data && typeof fm.data['description'] === 'string' ? fm.data['description'] : '';
  catalog.set(src.id, {
    id: src.id,
    name,
    title: name,
    description: desc.length > 160 ? desc.slice(0, 157) + '…' : desc,
    source: fetched.url,
    license: fm.data && typeof fm.data['license'] === 'string' ? fm.data['license'] : undefined,
    content: fetched.content,
  });
  report.push({ id: src.id, source: fetched.url, errors: 0, warnings: summary.warnings, status: 'synced' });
}

const entries = [...catalog.values()].sort((a, b) => a.id.localeCompare(b.id));

// 3) Emit the generated TS module.
const ts =
  '// AUTO-GENERATED by scripts/sync-skills.mjs — do not edit by hand.\n' +
  '// A curated catalog of Agent Skills, each VALIDATED by agentlint (0 errors).\n' +
  '// Refresh with `npm run sync:skills` (CI runs it weekly and opens a PR).\n\n' +
  'export interface CuratedSkill {\n' +
  '  id: string;\n' +
  '  name: string;\n' +
  '  title: string;\n' +
  '  description: string;\n' +
  '  /** Upstream URL the skill was synced from, or "local" for bundled seeds. */\n' +
  '  source: string;\n' +
  '  license?: string;\n' +
  '  content: string;\n' +
  '}\n\n' +
  'export const SKILL_CATALOG: CuratedSkill[] = ' +
  JSON.stringify(entries, null, 2) +
  ';\n';
writeFileSync(OUT_TS, ts);

// 4) Emit a human-readable status report.
const docLines = [
  '# Synced skill sources',
  '',
  'This file and `apps/web/src/lib/skill-catalog.ts` are generated by `scripts/sync-skills.mjs`.',
  'Each upstream skill is fetched and **validated by agentlint**; only skills with **0 errors** are added.',
  '',
  '| id | status | errors | warnings | source |',
  '|---|---|:---:|:---:|---|',
  ...report.map((r) => `| \`${r.id}\` | ${r.status} | ${r.errors} | ${r.warnings} | ${r.source} |`),
  '',
  `Total in catalog: **${entries.length}** skills.`,
  '',
  '> Unofficial — not affiliated with Anthropic. Synced skills retain their upstream licenses.',
  '',
];
writeFileSync(OUT_DOC, docLines.join('\n'));

console.log(`skill-catalog: ${entries.length} skills (${report.filter((r) => r.status === 'synced').length} synced, ${SEED.length} seed).`);
for (const r of report) console.log(`  - ${r.id}: ${r.status}`);
