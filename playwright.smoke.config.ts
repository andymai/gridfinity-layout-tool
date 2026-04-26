import { defineConfig, devices } from '@playwright/test';

// Standalone Playwright config for the deploy-gate smoke spec.
//
// Differs from the main config in two ways:
//   1. No `webServer` — we run against an external URL (Vercel preview).
//   2. Single project (chromium) — boot smoke only, browser matrix lives in
//      the main e2e suite.
//
// The target URL is provided via PREVIEW_URL env var by the GitHub workflow.
const previewUrl = process.env.PREVIEW_URL;
if (!previewUrl) {
  throw new Error('PREVIEW_URL env var is required for the smoke config');
}

export default defineConfig({
  testDir: './e2e',
  testMatch: 'smoke-preview.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: previewUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
});
