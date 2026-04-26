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

// Vercel Deployment Protection on previews returns HTTP 401 unless the
// caller presents a bypass token. When VERCEL_AUTOMATION_BYPASS_SECRET is
// set, send it as both a header (for the initial request) and a cookie
// (for subsequent SPA navigations). See:
// https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const extraHTTPHeaders = bypassSecret
  ? { 'x-vercel-protection-bypass': bypassSecret, 'x-vercel-set-bypass-cookie': 'true' }
  : undefined;

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
    extraHTTPHeaders,
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
