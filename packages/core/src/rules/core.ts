/**
 * Core engine rules (`core/*`).
 *
 * These document findings that the engine emits directly (outside the normal
 * per-rule `check` phase) so they still appear in the exported rule catalog
 * (web /rules page + docs). Their `check` is a no-op — the engine produces the
 * actual finding (see {@link file://./../engine.ts} `lintAndFix`).
 */
import type { Rule } from '../types.js';

export const coreRules: Rule[] = [
  {
    id: 'core/file-too-large',
    severity: 'warning',
    fixable: false,
    docsSlug: 'core/file-too-large',
    // Applies to every file kind: the engine emits this before parsing, for any
    // discovered file that exceeds the size cap.
    appliesTo: ['agent', 'command', 'settings', 'mcp', 'claudemd', 'unknown'],
    meta: {
      title: 'File is too large to lint',
      description:
        'The file exceeds agentlint’s per-file size cap (1 MiB) and is skipped to avoid excessive memory use. Split or trim the file so it can be linted.',
    },
    // The engine emits this finding directly during discovery/size-check; the
    // catalog entry exists for docs and the web rules page. No per-file check.
    check() {
      return [];
    },
  },
];
