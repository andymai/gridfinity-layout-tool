/**
 * Vitest config for __dual-kernel__ profiling / parity / diagnostic tests.
 *
 * Extends the main vitest.config.ts to inherit aliases and resolve settings,
 * then overrides for WASM-heavy infrastructure tests (node env, longer
 * timeouts, fork pool, single worker).
 *
 * Run:
 *   npx vitest run --config vitest.profile.config.ts __dual-kernel__/topologyParity
 *   npx vitest run --config vitest.profile.config.ts __dual-kernel__/diagnoseOps
 *   npx vitest run --config vitest.profile.config.ts __dual-kernel__/brepkitStress
 */
import { defineConfig, mergeConfig } from 'vitest/config';
import wasm from 'vite-plugin-wasm';
import mainConfig from './vitest.config';

export default mergeConfig(
  mainConfig,
  defineConfig({
    plugins: [wasm()],
    test: {
      environment: 'node',
      setupFiles: [],
      include: ['src/features/generation/worker/generators/__dual-kernel__/**/*.test.ts'],
      exclude: [],
      testTimeout: 600_000,
      pool: 'forks',
      maxWorkers: 1,
    },
  })
);
