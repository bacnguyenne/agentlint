/**
 * Client-side linting.
 *
 * agentlint-core's `lintFiles` is pure JS with no `node:` APIs, so the validator
 * runs entirely in the browser — your config never leaves the page. This replaces
 * the old POST /api/lint server path and lets the app deploy as a fully static
 * site (e.g. GitHub Pages). Mirrors the size guards from the old handler (minus
 * server-only rate limiting, which is meaningless client-side).
 */
import { lintFiles, type FileKind, type LintResult } from 'agentlint-core';
import { MAX_FILES, MAX_PATH_LENGTH, MAX_TOTAL_INPUT_BYTES, byteLength } from './config';

export interface ClientFile {
  path: string;
  content: string;
  kind?: FileKind;
}

/** Thrown when the combined input exceeds the size cap. */
export class InputTooLargeError extends Error {
  constructor() {
    super('Input too large.');
    this.name = 'InputTooLargeError';
  }
}

/**
 * Validate input sizes (a UX guard against pathological pastes) and lint in the
 * browser. Pure: never executes, imports, or fetches the user's content.
 */
export function lintClientSide(files: ClientFile[]): LintResult {
  if (files.length < 1 || files.length > MAX_FILES) {
    throw new Error('Invalid number of files.');
  }
  let total = 0;
  for (const f of files) {
    if (f.path.length < 1 || f.path.length > MAX_PATH_LENGTH) {
      throw new Error('Invalid file path.');
    }
    total += byteLength(f.content) + byteLength(f.path);
    if (total > MAX_TOTAL_INPUT_BYTES) {
      throw new InputTooLargeError();
    }
  }
  return lintFiles(
    files.map((f) => ({
      path: f.path,
      content: f.content,
      ...(f.kind ? { kind: f.kind } : {}),
    })),
  );
}
