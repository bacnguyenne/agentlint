/**
 * Shared helpers to build a {@link ParsedFile} and a {@link RuleContext}.
 * Used by both the engine (check phase) and the fixer (fix phase) so parsing
 * and location math live in exactly one place.
 */
import type { FileKind, ParsedFile, RuleContext } from '../types.js';
import { parseFrontmatter } from './frontmatter.js';
import { parseJson } from './json.js';

const MARKDOWN_KINDS: ReadonlySet<FileKind> = new Set(['agent', 'command', 'skill']);
const JSON_KINDS: ReadonlySet<FileKind> = new Set(['settings', 'mcp']);

/** Build a {@link ParsedFile} from already-normalized content. */
export function buildParsedFile(path: string, kind: FileKind, content: string): ParsedFile {
  const parsed: ParsedFile = { path, kind, content };
  if (MARKDOWN_KINDS.has(kind)) parsed.frontmatter = parseFrontmatter(content);
  else if (JSON_KINDS.has(kind)) parsed.json = parseJson(content);
  return parsed;
}

/** Precompute line start offsets for O(log n) offset→{line,column} lookups. */
function buildLineIndex(content: string): number[] {
  const starts = [0];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') starts.push(i + 1);
  }
  return starts;
}

/** Build a {@link RuleContext} with a binary-search offset mapper. */
export function makeRuleContext(file: ParsedFile): RuleContext {
  const lineStarts = buildLineIndex(file.content);
  return {
    file,
    offsetToLineColumn(offset: number) {
      let lo = 0;
      let hi = lineStarts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if ((lineStarts[mid] ?? 0) <= offset) lo = mid;
        else hi = mid - 1;
      }
      const lineStart = lineStarts[lo] ?? 0;
      return { line: lo + 1, column: offset - lineStart + 1 };
    },
  };
}
