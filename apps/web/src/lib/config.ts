/**
 * Shared, environment-independent configuration constants for the web app.
 * Kept in one place so limits are auditable and testable.
 */

/**
 * Hard cap on the total decoded size of a single /api/lint request body
 * (sum of all file contents + paths). Requests over this return HTTP 413.
 * 256 KiB is generous for hand-pasted agent configs while bounding memory and
 * regex work (defense against ReDoS / DoS via huge inputs).
 */
export const MAX_TOTAL_INPUT_BYTES = 256 * 1024;

/** Maximum number of files accepted in a single request. */
export const MAX_FILES = 20;

/** Maximum length of a single file path string. */
export const MAX_PATH_LENGTH = 1024;

/** Rate limit: requests allowed per IP within the window. */
export const RATE_LIMIT_MAX = 30;

/** Rate limit window length, in milliseconds. */
export const RATE_LIMIT_WINDOW_MS = 60_000;

/** Byte length of a UTF-8 string (Node + Edge both expose TextEncoder). */
export function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}
