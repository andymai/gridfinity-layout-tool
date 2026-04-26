import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke-only Playwright config — runs against a deployed URL (Vercel preview or
 * production). Used by `.github/workflows/smoke-preview.yml` and
 * `smoke-postpromote.yml`. The broader suite still uses `playwright.config.ts`.
 *
 * No webServer block: the target URL must already be reachable. Set
 * `PLAYWRIGHT_TEST_BASE_URL` to point at the deployment.
 */
export default defineConfig({
  testDir: './e2e/smoke',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  timeout: 30_000, // total per-test budget
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL ?? 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 10_000,
    // NOTE: don't set extraHTTPHeaders for the Vercel bypass token here.
    // Playwright sends `extraHTTPHeaders` on EVERY outgoing request including
    // third-party (fonts.gstatic.com etc.), and those origins reject unknown
    // headers via CORS preflight, breaking asset loading. The smoke spec sets
    // a same-origin bypass cookie via the navigation query string instead, and
    // includes the header explicitly only on direct same-origin API calls.
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
  ],
});
