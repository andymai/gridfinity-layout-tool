import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: ['e2e/**', 'node_modules/**', '**/*.visual.tsx', '.worktrees/**'],
    // Increase timeout for CI environment (can be 5-10x slower than local dev)
    testTimeout: 30000,
    // Use threads pool for faster jsdom tests
    pool: 'threads',
    // CI runners have limited cores, local dev can use more
    maxWorkers: process.env.CI ? '50%' : '75%',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      exclude: [
        'node_modules/**',
        'e2e/**',
        'src/test/**',
        '**/*.test.{ts,tsx}',
        '**/*.visual.tsx',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types.ts',
        '**/index.ts', // Barrel files (re-exports only)
        'api/**', // Serverless functions tested separately
        'src/components/Collab/**', // Feature-flagged, requires Liveblocks mock
        'src/hooks/usePresence.ts', // Feature-flagged, tested via usePresence.test.ts utilities
      ],
      thresholds: {
        // Thresholds set slightly below current coverage to catch regressions.
        // Updated 2026-02-23: Adjusted for www-migration module (DOM-heavy, one-time code).
        lines: 77.5,
        branches: 69,
        functions: 76,
        statements: 76.5,
      },
    },
  },
  resolve: {
    alias: {
      // Path alias for clean imports
      '@': path.resolve(__dirname, 'src'),
      // Mock virtual PWA module for tests
      'virtual:pwa-register/react': path.resolve(__dirname, 'src/test/mocks/pwa-register.ts'),
      // Force all three imports (including nested copies from stats-gl) to resolve
      // to a single instance — prevents "THREE.WARNING: Multiple instances" noise.
      three: path.resolve(__dirname, 'node_modules/three'),
    },
    dedupe: ['three'],
  },
});
