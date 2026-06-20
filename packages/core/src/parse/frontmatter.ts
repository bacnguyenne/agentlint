/**
 * YAML frontmatter splitting for Markdown files (`agent`, `command`).
 *
 * A frontmatter block is a leading `---` line, the YAML body, and a closing
 * `---` (or `...`) line. We parse the YAML with the `yaml` package and return
 * the data, the Markdown body, and line offsets so rules can report accurate
 * file line numbers for both frontmatter and body content.
 *
 * This module never executes content; it only parses text.
 */
import { parse as parseYaml, YAMLParseError } from 'yaml';
import type { ParsedFrontmatter, ParseError } from '../types.js';

/**
 * Strip a leading UTF-8 BOM and normalize CRLF/CR line endings to LF so line
 * counting and `---` detection are consistent across platforms.
 */
export function normalizeText(input: string): string {
  let text = input;
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }
  // Normalize CRLF and lone CR to LF.
  return text.replace(/\r\n?/g, '\n');
}

/**
 * Split YAML frontmatter from a Markdown document.
 *
 * Recognizes a frontmatter block only when the very first line is exactly
 * `---` (after optional BOM removal). The closing fence is the next line that
 * is exactly `---` or `...`.
 */
export function parseFrontmatter(rawInput: string): ParsedFrontmatter {
  const text = normalizeText(rawInput);
  const lines = text.split('\n');

  // No frontmatter unless the first line is exactly the opening fence.
  if (lines.length === 0 || lines[0] !== '---') {
    return {
      hasFrontmatter: false,
      data: undefined,
      body: text,
      bodyStartLine: 1,
      frontmatterStartLine: 0,
    };
  }

  // Find the closing fence among subsequent lines.
  let closeIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === '---' || line === '...') {
      closeIndex = i;
      break;
    }
  }

  if (closeIndex === -1) {
    // Opening fence but no closing fence: treat the whole thing as a malformed
    // frontmatter block. Report a parse error and keep an empty body.
    const yamlText = lines.slice(1).join('\n');
    const error: ParseError = {
      message: 'Frontmatter block is not terminated (missing closing "---").',
      line: 1,
      column: 1,
    };
    const result = tryParseYaml(yamlText);
    return {
      hasFrontmatter: true,
      data: result.data,
      error: result.error ?? error,
      body: '',
      bodyStartLine: lines.length + 1,
      frontmatterStartLine: 2,
    };
  }

  const yamlLines = lines.slice(1, closeIndex);
  const yamlText = yamlLines.join('\n');
  const bodyLines = lines.slice(closeIndex + 1);
  // Drop a single leading blank line after the closing fence for a cleaner
  // body, but keep the line accounting correct.
  let bodyStartLine = closeIndex + 2; // 1-based line of first body line
  let body = bodyLines.join('\n');
  if (bodyLines.length > 0 && bodyLines[0] === '') {
    body = bodyLines.slice(1).join('\n');
    bodyStartLine += 1;
  }

  const result = tryParseYaml(yamlText);
  return {
    hasFrontmatter: true,
    data: result.data,
    ...(result.error ? { error: result.error } : {}),
    body,
    bodyStartLine,
    frontmatterStartLine: 2, // first YAML line is line 2 in the file
  };
}

/**
 * Parse a YAML string into a plain object. Returns `{ data: undefined }` for
 * empty input, a parse error for malformed YAML, and a normalized object for
 * valid mappings. Non-object top-level YAML (e.g. a bare scalar) yields a
 * parse error since frontmatter must be a mapping.
 */
function tryParseYaml(yamlText: string): {
  data: Record<string, unknown> | undefined;
  error?: ParseError;
} {
  const trimmed = yamlText.trim();
  if (trimmed === '') {
    return { data: undefined };
  }
  try {
    // `maxAliasCount` is set EXPLICITLY (not relying on the library default) to
    // cap YAML alias expansion — a defense against billion-laughs / alias-bomb
    // DoS. Agent/command frontmatter never legitimately uses YAML aliases, so a
    // modest cap is safe and keeps the protection auditable.
    const value = parseYaml(yamlText, { prettyErrors: true, maxAliasCount: 100 });
    if (value === null || value === undefined) {
      return { data: undefined };
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
      return {
        data: undefined,
        error: {
          message: 'Frontmatter must be a YAML mapping (key: value pairs).',
          // +1 to convert YAML-body line to file line (body starts at file line 2).
          line: 2,
          column: 1,
        },
      };
    }
    return { data: value as Record<string, unknown> };
  } catch (err) {
    const error: ParseError = toParseError(err);
    return { data: undefined, error };
  }
}

/** Convert a YAML error to our {@link ParseError}, mapping to file lines. */
function toParseError(err: unknown): ParseError {
  if (err instanceof YAMLParseError) {
    // `linePos` is 1-based [start, end] within the YAML text. The YAML text
    // begins at file line 2, so add 1 to map back to the file.
    const pos = err.linePos?.[0];
    const line = pos ? pos.line + 1 : 2;
    const column = pos ? pos.col : 1;
    return {
      message: err.message.split('\n')[0] ?? 'YAML parse error',
      line,
      column,
    };
  }
  return {
    message: err instanceof Error ? err.message : 'YAML parse error',
    line: 2,
    column: 1,
  };
}
