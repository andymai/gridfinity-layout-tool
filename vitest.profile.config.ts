/**
 * Vitest config for __kernel-tests__ profiling / parity / diagnostic tests.
 *
 * Standalone config for WASM-heavy kernel tests (node env, longer
 * timeouts, fork pool, single worker). Mirrors the resolve config from
 * vitest.config.ts to ensure consistent path aliases.
 *
 * Run:
 *   pnpm exec vitest run --config vitest.profile.config.ts __kernel-tests__/topologyParity
 *   pnpm exec vitest run --config vitest.profile.config.ts __kernel-tests__/diagnoseOps
 *   pnpm exec vitest run --config vitest.profile.config.ts __kernel-tests__/brepkitStress
 */
import { defineConfig } from 'vitest/config';
import path from 'path';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  plugins: [wasm()],
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/features/generation/worker/generators/__kernel-tests__/**/*.test.ts',
      'src/features/generation/worker/generators/tessellation.perf.test.ts',
    ],
    exclude: [],
    testTimeout: 600_000,
    pool: 'forks',
    maxWorkers: 1,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'virtual:pwa-register/react': path.resolve(__dirname, 'src/test/mocks/pwa-register.ts'),
      three: path.resolve(__dirname, 'node_modules/three'),
    },
    dedupe: ['three'],
  },
});
