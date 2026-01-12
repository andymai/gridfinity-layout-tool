import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0, // CHANGED: No retries - fix flakes instead of masking them
  workers: process.env.CI ? 2 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.CI ? 'http://localhost:4173' : 'http://localhost:5173',
    trace: 'retain-on-failure', // CHANGED: Capture traces on first failure (not retry)
    contextOptions: {
      clearCookies: true, // NEW: Enable cookie isolation between tests
    },
    screenshot: 'only-on-failure', // NEW: Capture screenshots for debugging
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }, // NEW: Baseline viewport for all tests
      },
    },
  ],
  webServer: {
    command: process.env.CI ? 'npm run preview' : 'npm run dev',
    url: process.env.CI ? 'http://localhost:4173' : 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
