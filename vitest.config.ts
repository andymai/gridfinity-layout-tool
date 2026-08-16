// vitest.config.ts
// Root config with two workspace projects: unit (node) and dom (jsdom).
// Vitest 4 uses inline `projects` array instead of vitest.workspace.ts.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Shared exclude patterns — must match both projects
const sharedExclude = [
  'e2e/**',
  'node_modules/**',
  '**/*.visual.tsx',
  '**/*.bench.ts',
  '.worktrees/**',
  '**/__kernel-tests__/**',
];

// DOM project claims these globs — everything else goes to unit.
// Listed here so the unit project can exclude them to prevent double-counting.
const domIncludes = [
  // All .test.tsx files are React component tests and need jsdom.
  'src/**/*.test.tsx',
  'src/shared/components/**/*.test.{ts,tsx}',
  // `src/shared/help/` tests live directly under the prefix with no
  // sub-directory, which not every glob implementation matches via `**/`.
  // Both patterns guarantee the dispatcher test lands in jsdom env.
  'src/shared/help/*.test.{ts,tsx}',
  'src/shared/help/**/*.test.{ts,tsx}',
  'src/shared/hooks/**/*.test.{ts,tsx}',
  'src/shared/webgl/**/*.test.{ts,tsx}',
  'src/features/**/components/**/*.test.{ts,tsx}',
  'src/features/**/hooks/**/*.test.{ts,tsx}',
  'src/design-system/**/*.test.{ts,tsx}',
  'src/shell/**/*.test.{ts,tsx}',
];

// Heavy brepjs/OpenCascade WASM generator tests. Isolated into their own
// project (same node env/setup as `unit`) so CI can run them on dedicated
// runners — Vitest shards by hashing the file path, not by duration, so left
// in `unit` they cluster onto one shard and dominate wall time. The `unit`
// project excludes these to avoid double-counting; the full local/coverage run
// still executes all three projects.
const generatorIncludes = ['src/features/generation/worker/generators/**/*.test.ts'];

// Tests that need a real Redis rather than a hand-rolled ioredis mock — a Lua
// script's behaviour cannot be asserted against a mock. Isolated into their own
// project so the default `unit` run stays dependency-free; CI supplies
// REDIS_TEST_URL from a service container.
const integrationIncludes = ['api/**/*.integration.test.ts'];

export default defineConfig({
  plugins: [react()],
  // Build-time version constants (provided by versionPlugin in the real build).
  // Defined here so PWA modules that reference them are testable under Vitest.
  define: {
    __APP_VERSION__: JSON.stringify('0.0.0-test'),
    __GIT_SHA__: JSON.stringify('test-sha'),
    __BUILD_TIME__: JSON.stringify('1970-01-01T00:00:00.000Z'),
  },
  test: {
    globals: true,
    testTimeout: 30000,
    // Kernel-specific snapshot files: scenario triangle counts depend on the
    // active kernel's tessellation density, so route each non-default kernel to
    // its own `.<kernel>.snap`. The default (occt-wasm) keeps the plain `.snap`
    // files, so existing baselines are untouched; BREPJS_KERNEL=brepkit
    // reads/writes `.brepkit.snap`. Without this a single shared snapshot could
    // only ever match one kernel. (resolveSnapshotPath is a root-only vitest
    // option — it cannot live in a project config.)
    resolveSnapshotPath: (testPath: string, snapExtension: string): string => {
      const raw = process.env.BREPJS_KERNEL ?? '';
      const kernel = raw === 'wasm' ? 'brepkit' : raw;
      const suffix = kernel && kernel !== 'occt-wasm' ? `.${kernel}` : '';
      return path.join(
        path.dirname(testPath),
        '__snapshots__',
        `${path.basename(testPath)}${suffix}${snapExtension}`
      );
    },
    pool: 'threads',
    maxWorkers: process.env.CI ? '100%' : '75%',
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
        '**/index.ts',
        // api/ is NOT excluded. Its tests already run in the unit project, so
        // excluding it only suppressed the report: a well-covered, security-
        // sensitive surface (auth, moderation, quotas, rate limits) sat under
        // no threshold at all, and a regression there registered as nothing.
        'src/shell/Collab/**',
        'src/shared/hooks/usePresence.ts',
      ],
      // Set just under what the suite actually achieves (84.0 / 77.3 / 80.9 /
      // 82.5), leaving room for ordinary churn. They had drifted 6-9 points
      // below reality, so a real regression could land without tripping one.
      thresholds: {
        lines: 82,
        branches: 75,
        functions: 79,
        statements: 81,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          setupFiles: ['./src/test/setup.ts'],
          include: [
            'src/**/*.test.ts',
            'api/**/*.test.ts',
            'scripts/**/*.test.ts',
            'packages/**/*.test.ts',
          ],
          exclude: [...sharedExclude, ...domIncludes, ...generatorIncludes, ...integrationIncludes],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts', './src/test/setup-dom.ts'],
          include: domIncludes,
          exclude: sharedExclude,
        },
      },
      {
        extends: true,
        test: {
          name: 'generators',
          environment: 'node',
          setupFiles: ['./src/test/setup.ts'],
          include: generatorIncludes,
          exclude: sharedExclude,
          // The root 30s is calibrated for pure-JS tests that finish in
          // milliseconds. Everything here drives real OCCT booleans, and 1423
          // of the project's 1748 `it`s inherit that figure rather than
          // declaring their own, so the cap the heavy tests actually run under
          // was set by a different workload's needs. The slowest of them cost
          // ~12s, 40% of the budget, and a shared runner spends that margin
          // (#3537): the test that timed out differed every attempt because it
          // was only ever whichever inherited test was slowest that run. 120s
          // is the tier the deliberately-annotated heavy files already use.
          //
          // This is a liveness bound, not a performance budget. The perf tests
          // assert their own ceilings against `performance.now()`
          // (tessellation.perf, height.perf, compartments.perf), so a slow
          // regression is still caught by the assertion that exists for it, and
          // a wedged kernel is still bounded by the job's `timeout-minutes`.
          testTimeout: 120_000,
          // Separate knob with its own, tighter default (10s), and every file
          // here boots the WASM kernel via `initTestKernel()` in `beforeAll`.
          // 175 of 199 hooks were given an explicit raise by hand, which is why
          // `}, 30000)` on a hook is load-bearing rather than a restatement of
          // the default the way the `it`-level ones are. This covers the 24 that
          // were never given one.
          hookTimeout: 120_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          setupFiles: ['./src/test/setup.ts'],
          include: integrationIncludes,
          exclude: sharedExclude,
          // Every integration file FLUSHDBs the same Redis in beforeEach, so
          // running them in parallel lets one file wipe another's state
          // mid-test. That surfaced as unrelated-looking flakes: a rate-limit
          // window losing entries, a like toggle finding its sets empty.
          // Serialising the files is the fix; they are fast and few.
          fileParallelism: false,
        },
      },
    ],
    benchmark: {
      include: ['**/*.bench.ts'],
      exclude: ['node_modules/**', '.worktrees/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@gridfinity/branded-types': path.resolve(__dirname, 'packages/branded-types/src/index.ts'),
      'virtual:pwa-register/react': path.resolve(__dirname, 'src/test/mocks/pwa-register.ts'),
      three: path.resolve(__dirname, 'node_modules/three'),
    },
    dedupe: ['three'],
  },
});
