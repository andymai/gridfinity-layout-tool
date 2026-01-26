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
    // Increase timeout for CI environment (slower than local dev)
    testTimeout: 10000,
    // Optimized for high-core-count CPUs (Ryzen 9 7950X3D: 16c/32t)
    pool: 'threads', // Worker threads are faster than forks for jsdom tests
    maxWorkers: 32, // Use all available threads
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      exclude: [
        'node_modules/**',
        'e2e/**',
        'src/test/**',
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
        // Updated 2026-01-25: Adjusted after i18n PR, bin-designer, and generation refactors
        lines: 81,
        branches: 69,
        functions: 81,
        statements: 80,
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
