import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      // types.ts is type-only (no runtime statements); excluding it keeps the
      // reported numbers meaningful rather than diluted by a 0%-of-0 file.
      exclude: ['src/types.ts'],
      reporter: ['text', 'json-summary'],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 80,
      },
    },
  },
});
