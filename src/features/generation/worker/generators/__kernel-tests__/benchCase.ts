import { test } from 'vitest';

// Cold brepjs builds run for tens of seconds per iteration; the root 30s
// testTimeout would cut the larger cases short.
const BENCH_TIMEOUT_MS = 300_000;

interface BenchCaseOptions {
  iterations: number;
  warmupIterations: number;
}

// Vitest 5 exposes `bench` as a test-context fixture rather than a top-level
// export, so each case is a test that runs one registration.
export function benchCase(name: string, fn: () => void, options: BenchCaseOptions): void {
  test(name, { timeout: BENCH_TIMEOUT_MS }, async ({ bench }) => {
    await bench(name, fn).run(options);
  });
}
