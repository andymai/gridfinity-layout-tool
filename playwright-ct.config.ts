import { defineConfig, devices } from '@playwright/experimental-ct-react';
import tailwindcss from '@tailwindcss/vite';
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
      // Processes the `@import 'tailwindcss'` reached through `playwright/ct.css`.
      // Without it that import is inert and every utility class resolves to
      // nothing, which is how this suite screenshotted unstyled components and
      // still passed. The companion half is the explicit `@source` in ct.css —
      // both are required, and removing either returns the components to bare text.
      plugins: [tailwindcss()],
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
