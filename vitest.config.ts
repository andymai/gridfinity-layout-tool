import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: ['e2e/**', 'node_modules/**'],
    // Increase timeout for CI environment (can be 5-10x slower than local dev)
    testTimeout: 30000,
    // Use threads pool for faster jsdom tests
    pool: 'threads',
    // CI runners have limited cores, local dev can use more
    maxWorkers: process.env.CI ? 4 : 32,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      exclude: [
        'node_modules/**',
        'e2e/**',
        'src/test/**',
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types.ts',
        '**/index.ts', // Barrel files (re-exports only)
        'api/**', // Serverless functions tested separately
        'src/components/Collab/**', // Feature-flagged, requires Liveblocks mock
        'src/hooks/usePresence.ts', // Feature-flagged, tested via usePresence.test.ts utilities
      ],
      thresholds: {
        // Thresholds set slightly below current coverage to prevent regression
        // Updated 2026-02-02: Adjusted after adding worker-side split export (untestable in jsdom)
        lines: 78,
        branches: 66.5,
        functions: 78,
        statements: 77.5,
      },
    },
  },
  resolve: {
    alias: {
      // Path alias for clean imports
      '@': path.resolve(__dirname, 'src'),
      // Mock virtual PWA module for tests
      'virtual:pwa-register/react': path.resolve(__dirname, 'src/test/mocks/pwa-register.ts'),
    },
  },
});
