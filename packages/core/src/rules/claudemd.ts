/**
 * CLAUDE.md rules (`claudemd/*`) — SPEC §2.5.
 *
 * CLAUDE.md is freeform Markdown; only heuristics apply: warn on an empty file
 * (no guidance) and on an extremely large file (context bloat). Security rules
 * (hardcoded-secret, remote-code-execution) also run over CLAUDE.md via their
 * own `appliesTo`.
 */
import type { Rule } from '../types.js';
import { makeFinding } from './util.js';

const DOCS_BASE = 'claudemd';

/** Soft size threshold (chars) above which we warn about context bloat. */
export const CLAUDEMD_LARGE_CHARS = 40_000;

export const claudemdRules: Rule[] = [
  {
    id: 'claudemd/empty',
    severity: 'warning',
    fixable: false,
    docsSlug: `${DOCS_BASE}/empty`,
    appliesTo: ['claudemd'],
    meta: { title: 'CLAUDE.md is empty', description: 'An empty CLAUDE.md provides no project guidance to the agent.' },
    check(ctx) {
      if (ctx.file.content.trim() === '') {
        return [makeFinding(this, ctx, 'CLAUDE.md is empty; it should contain project guidance for the agent.', { line: 1, column: 1 })];
      }
      return [];
    },
  },
  {
    id: 'claudemd/too-large',
    severity: 'warning',
    fixable: false,
    docsSlug: `${DOCS_BASE}/too-large`,
    appliesTo: ['claudemd'],
    meta: {
      title: 'CLAUDE.md is very large',
      description: 'A very large CLAUDE.md consumes context budget on every request; consider trimming or splitting it.',
    },
    check(ctx) {
      const len = ctx.file.content.length;
      if (len > CLAUDEMD_LARGE_CHARS) {
        return [
          makeFinding(
            this,
            ctx,
            `CLAUDE.md is large (${len} chars > ${CLAUDEMD_LARGE_CHARS}); large context files inflate every request.`,
            { line: 1, column: 1 },
          ),
        ];
      }
      return [];
    },
  },
];
