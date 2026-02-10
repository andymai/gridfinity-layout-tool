import { defineConfig, devices } from '@playwright/experimental-ct-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  testDir: './src/design-system',
  testMatch: '**/*.visual.tsx',
  snapshotDir: './src/design-system/__snapshots__',
  outputDir: './test-results/ct',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    ctPort: 3100,
    ctViteConfig: {
      resolve: {
        alias: {
          '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
      },
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 800, height: 600 },
      },
    },
  ],
});
