import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3101);
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * E2E config. Builds and starts the production server (so security headers and
 * the real CSP are exercised), then runs Chromium against it.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: BASE_URL,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    // The suite runs fully parallel from a single client IP; relax the API rate
    // limit for the test server so legitimate requests aren't 429'd (the
    // production default stays 30 req/60s — see src/lib/server.ts).
    env: { AGENTLINT_RATE_LIMIT_MAX: '100000' },
  },
});
