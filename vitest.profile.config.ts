/**
 * Vitest config for __dual-kernel__ profiling / parity / diagnostic tests.
 *
 * Standalone config for WASM-heavy dual-kernel tests (node env, longer
 * timeouts, fork pool, single worker). Mirrors the resolve config from
 * vitest.config.ts to ensure consistent path aliases.
 *
 * Run:
 *   npx vitest run --config vitest.profile.config.ts __dual-kernel__/topologyParity
 *   npx vitest run --config vitest.profile.config.ts __dual-kernel__/diagnoseOps
 *   npx vitest run --config vitest.profile.config.ts __dual-kernel__/brepkitStress
 */
import { defineConfig } from 'vitest/config';
import path from 'path';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  plugins: [wasm()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/features/generation/worker/generators/__dual-kernel__/**/*.test.ts'],
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
