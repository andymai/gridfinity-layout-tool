/**
 * A wall-clock limit for a performance test. Coverage instrumentation (the
 * main-branch CI shards, `pnpm run test:coverage`) slows tight loops several
 * times over, so there the limit stretches by {@link COVERAGE_SLOWDOWN}; any
 * other run keeps it as written.
 */
export const COVERAGE_SLOWDOWN = 10;

export function timeLimitMs(ms: number): number {
  return process.env.VITEST_COVERAGE_RUN === '1' ? ms * COVERAGE_SLOWDOWN : ms;
}
