/**
 * Vitest config for __test-infra__ profiling / parity tests.
 *
 * These tests are excluded from the main config because they require
 * WASM kernels (OCCT + brepkit) and are slow. Run manually:
 *
 *   npx vitest run --config vitest.profile.config.ts __test-infra__/visualParity
 *   npx vitest run --config vitest.profile.config.ts __test-infra__/exportParity
 *   npx vitest run --config vitest.profile.config.ts __test-infra__/brepkitStress
 */
import { defineConfig } from 'vitest/config';
import path from 'path';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  plugins: [wasm()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/features/generation/worker/generators/__test-infra__/**/*.test.ts'],
    testTimeout: 600_000,
    pool: 'forks',
    maxWorkers: 1,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
