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
        'api/**',
        'src/shell/Collab/**',
        'src/shared/hooks/usePresence.ts',
      ],
      thresholds: {
        lines: 76,
        branches: 68,
        functions: 74,
        statements: 75,
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
          exclude: [...sharedExclude, ...domIncludes, ...generatorIncludes],
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
