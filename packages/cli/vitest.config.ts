import { defineConfig } from 'vitest/config';

/**
 * `fileParallelism: false` — every test file builds the CLI in `beforeAll`, and
 * the tests then spawn `dist/index.js` as a child process. Run the files in
 * parallel and one file's rebuild truncates `dist/` while another file's child
 * process is loading it, so a passing lint exits 1 at random (seen in CI as
 * "expected 1 to be +0" on a clean fixture). Serialising the files removes the
 * race; the suite is short enough that the wall-clock cost is small.
 */
export default defineConfig({
  test: { include: ['test/**/*.test.ts'], testTimeout: 30000, fileParallelism: false },
});
