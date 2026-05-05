/**
 * Tessellation performance regression guard.
 *
 * Measures total generation time (tessellation only — warm-up fills the shell
 * cache so BREP boolean-op time is excluded) for representative bin configs
 * and asserts they stay within a budget ceiling.
 *
 * Run in isolation via the profile config to avoid CI flakiness from
 * CPU contention with parallel test workers:
 *   pnpm exec vitest run --config vitest.profile.config.ts tessellation.perf
 *
 * Update baselines after verified tolerance changes:
 *   Adjust MAX_MS_* constants if the new timings are intentional.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

/**
 * Budget ceilings (ms). Set generously above observed timings to avoid
 * flaky failures on slow CI runners, while still catching regressions
 * that exceed the 2× target.
 */
const MAX_MS_SMALL_BIN = 3_000;
const MAX_MS_LARGE_BIN = 8_000;
const MAX_MS_COMPLEX_BIN = 10_000;
const MAX_MS_VERY_LARGE_BIN = 20_000;

/** Number of warm-up runs before measuring (fills shell cache). */
const WARMUP_RUNS = 1;
/** Number of measured runs to average. */
const MEASURE_RUNS = 3;

function benchmarkGeneration(params: ReturnType<typeof buildParams>, forExport = false): number {
  const generateBin = getGenerateBin();

  // Warm up: fills shell cache so measured runs only time tessellation + features
  for (let i = 0; i < WARMUP_RUNS; i++) {
    generateBin(params, undefined, forExport);
  }

  // Measure
  const times: number[] = [];
  for (let i = 0; i < MEASURE_RUNS; i++) {
    const start = performance.now();
    generateBin(params, undefined, forExport);
    times.push(performance.now() - start);
  }

  return times.reduce((a, b) => a + b, 0) / times.length;
}

describe('tessellation performance budget', () => {
  it(`2×2 standard bin with lip stays under ${MAX_MS_SMALL_BIN}ms`, () => {
    const params = buildParams({
      width: 2,
      depth: 2,
      height: 4,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'socket', stackingLip: true },
    });
    const avgMs = benchmarkGeneration(params);

    // eslint-disable-next-line no-console -- perf reporting
    console.log(`  2×2 lip bin: ${avgMs.toFixed(1)}ms avg (budget: ${MAX_MS_SMALL_BIN}ms)`);
    expect(avgMs).toBeLessThan(MAX_MS_SMALL_BIN);
  });

  it(`4×4 standard bin with lip stays under ${MAX_MS_LARGE_BIN}ms`, () => {
    const params = buildParams({
      width: 4,
      depth: 4,
      height: 4,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'socket', stackingLip: true },
    });
    const avgMs = benchmarkGeneration(params);

    // eslint-disable-next-line no-console -- perf reporting
    console.log(`  4×4 lip bin: ${avgMs.toFixed(1)}ms avg (budget: ${MAX_MS_LARGE_BIN}ms)`);
    expect(avgMs).toBeLessThan(MAX_MS_LARGE_BIN);
  });

  it(`8×8 standard bin with lip stays under ${MAX_MS_VERY_LARGE_BIN}ms`, () => {
    const params = buildParams({
      width: 8,
      depth: 8,
      height: 4,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'socket', stackingLip: true },
    });
    const avgMs = benchmarkGeneration(params);

    // eslint-disable-next-line no-console -- perf reporting
    console.log(`  8×8 lip bin: ${avgMs.toFixed(1)}ms avg (budget: ${MAX_MS_VERY_LARGE_BIN}ms)`);
    expect(avgMs).toBeLessThan(MAX_MS_VERY_LARGE_BIN);
  });

  it(`2×2 complex bin (lip + scoop + magnets + compartments) stays under ${MAX_MS_COMPLEX_BIN}ms`, () => {
    const params = buildParams({
      width: 2,
      depth: 2,
      height: 4,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', stackingLip: true },
      scoop: { enabled: true, radius: 'auto' },
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 },
    });
    const avgMs = benchmarkGeneration(params);

    // eslint-disable-next-line no-console -- perf reporting
    console.log(`  2×2 complex: ${avgMs.toFixed(1)}ms avg (budget: ${MAX_MS_COMPLEX_BIN}ms)`);
    expect(avgMs).toBeLessThan(MAX_MS_COMPLEX_BIN);
  });
});
