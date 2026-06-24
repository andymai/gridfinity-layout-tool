// @vitest-environment node
/**
 * Vitest benchmarks for bin generation.
 *
 * Covers core dimensions, hollow + features, half-bin mode, and export paths.
 * Run with:
 *
 *   pnpm exec vitest bench binGenerator
 *   BREPJS_KERNEL=wasm pnpm exec vitest bench binGenerator
 */
import { bench, describe, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from '@/shared/constants/bin';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { buildParams as params, makeInsert, makeCutout } from './__kernel-tests__/scenarioTypes';
import { buildBaseSocket } from './socketBuilder';
import { clearAllCaches } from './shapeCache';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

// ─── Core dimensions ──────────────────────────────────────────────────────────

describe('core dimensions', () => {
  bench(
    '0.5×0.5 with lip',
    () => {
      getGenerateBin()(params({ width: 0.5, depth: 0.5, height: 3 }));
    },
    { iterations: 10, warmupIterations: 2 }
  );

  bench(
    '1×1 with lip',
    () => {
      getGenerateBin()(params({ width: 1, depth: 1, height: 3 }));
    },
    { iterations: 10, warmupIterations: 2 }
  );

  bench(
    '1×1 no lip',
    () => {
      getGenerateBin()(
        params({
          width: 1,
          depth: 1,
          height: 3,
          base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
        })
      );
    },
    { iterations: 10, warmupIterations: 2 }
  );

  bench(
    '2×2 with lip',
    () => {
      getGenerateBin()(params({ width: 2, depth: 2, height: 3 }));
    },
    { iterations: 10, warmupIterations: 2 }
  );

  bench(
    '4×4 with lip',
    () => {
      getGenerateBin()(params({ width: 4, depth: 4, height: 6 }));
    },
    { iterations: 5, warmupIterations: 1 }
  );
});

// ─── Hollow + features ────────────────────────────────────────────────────────

describe('hollow + features', () => {
  bench(
    '2×2 hollow + scoop',
    () => {
      getGenerateBin()(
        params({
          width: 2,
          depth: 2,
          height: 3,
          scoop: { enabled: true, radius: 'auto' },
        })
      );
    },
    { iterations: 5, warmupIterations: 1 }
  );

  bench(
    '2×2 with insert',
    () => {
      getGenerateBin()(
        params({
          width: 2,
          depth: 2,
          height: 3,
          inserts: [makeInsert({ shape: 'circle', width: 30, depth: 30, cutDepth: 5 })],
        })
      );
    },
    { iterations: 5, warmupIterations: 1 }
  );

  bench(
    '2×2 with cutout',
    () => {
      getGenerateBin()(
        params({
          width: 2,
          depth: 2,
          height: 3,
          cutouts: [makeCutout({ shape: 'rectangle', width: 20, depth: 20, cutDepth: 5 })],
        })
      );
    },
    { iterations: 5, warmupIterations: 1 }
  );

  bench(
    '3×3 2×2 compartments + scoop',
    () => {
      getGenerateBin()(
        params({
          width: 3,
          depth: 3,
          height: 4,
          compartments: { cols: 2, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3] },
          scoop: { enabled: true, radius: 'auto' },
        })
      );
    },
    { iterations: 3, warmupIterations: 1 }
  );
});

// ─── Half-bin mode ────────────────────────────────────────────────────────────

describe('half-bin mode', () => {
  bench(
    '1.5×2.5 with lip',
    () => {
      getGenerateBin()(params({ width: 1.5, depth: 2.5, height: 3 }));
    },
    { iterations: 5, warmupIterations: 1 }
  );

  bench(
    '0.5×1.5 with lip',
    () => {
      getGenerateBin()(params({ width: 0.5, depth: 1.5, height: 2 }));
    },
    { iterations: 5, warmupIterations: 1 }
  );
});

// ─── Wall pattern + cutout cache behaviour (#1422) ───────────────────────────
//
// The cutout-param-change path previously blew past the 30s worker timeout on
// tall bins because the per-wall hex compound was invalidated on every tweak.
// These benches pin a measurable gap between the first build and a cutout-only
// nudge so the cache split doesn't silently regress.
describe('wall pattern + cutout cache reuse', () => {
  const HONEYCOMB_4X2X6 = params({
    width: 4,
    depth: 2,
    height: 6,
    wallPattern: { enabled: true, pattern: 'honeycomb' },
    walls: {
      ...DEFAULT_BIN_PARAMS.walls,
      enabled: true,
      front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
      back: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
      left: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
      right: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
      interior: DISABLED_WALL_CUTOUT,
    },
  });

  bench(
    'first build (cold): 4×2×6 honeycomb + cutouts',
    () => {
      getGenerateBin()(HONEYCOMB_4X2X6);
    },
    { iterations: 3, warmupIterations: 0 }
  );

  bench(
    'cutout-width nudge (warm): base compound should hit cache',
    () => {
      // Warm the base compound cache, then nudge the cutout widths.
      getGenerateBin()(HONEYCOMB_4X2X6);
      getGenerateBin()({
        ...HONEYCOMB_4X2X6,
        walls: {
          ...HONEYCOMB_4X2X6.walls,
          front: { ...HONEYCOMB_4X2X6.walls.front, width: 65 },
          back: { ...HONEYCOMB_4X2X6.walls.back, width: 65 },
          left: { ...HONEYCOMB_4X2X6.walls.left, width: 65 },
          right: { ...HONEYCOMB_4X2X6.walls.right, width: 65 },
        },
      });
    },
    { iterations: 3, warmupIterations: 1 }
  );
});

// ─── Dense compartments + cutouts (perf instrumentation baseline) ────────────
//
// Real-world worst-case scenarios that exercise the wall-pattern cold-cache
// path: a wide bin with many compartments and all four wall cutouts, a tall
// bin where hex prisms balloon, and a cache-warm iteration that should land
// almost entirely in the per-wall LRU.
//
// Numbers from these benches feed `__bench__/baseline.json`. When tuning
// wallPatternBuilder / wallPatternClips, compare here first.
describe('dense compartments + cutouts (wall pattern cold cache)', () => {
  const fourCutouts = (width: number, depth: number) => ({
    ...DEFAULT_BIN_PARAMS.walls,
    enabled: true,
    front: { ...DISABLED_WALL_CUTOUT, enabled: true, width, depth },
    back: { ...DISABLED_WALL_CUTOUT, enabled: true, width, depth },
    left: { ...DISABLED_WALL_CUTOUT, enabled: true, width, depth },
    right: { ...DISABLED_WALL_CUTOUT, enabled: true, width, depth },
    interior: DISABLED_WALL_CUTOUT,
  });

  const DENSE_WIDE = params({
    width: 6,
    depth: 4,
    height: 6,
    compartments: {
      cols: 12,
      rows: 8,
      thickness: 1.2,
      cells: Array.from({ length: 12 * 8 }, (_, i) => i),
    },
    wallPattern: { enabled: true, pattern: 'honeycomb' },
    walls: fourCutouts(70, 50),
  });

  const TALL_DENSE = params({
    width: 4,
    depth: 4,
    height: 6,
    compartments: {
      cols: 6,
      rows: 6,
      thickness: 1.2,
      cells: Array.from({ length: 6 * 6 }, (_, i) => i),
    },
    wallPattern: { enabled: true, pattern: 'honeycomb' },
    walls: fourCutouts(70, 50),
  });

  bench(
    'dense_wide_with_cutouts (cold): 6×4×6, 12×8 compartments, 4 cutouts',
    () => {
      getGenerateBin()(DENSE_WIDE);
    },
    { iterations: 3, warmupIterations: 0 }
  );

  bench(
    'tall_with_cutouts (cold): 4×4×6, 6×6 compartments, 4 cutouts',
    () => {
      getGenerateBin()(TALL_DENSE);
    },
    { iterations: 3, warmupIterations: 0 }
  );

  bench(
    'cache_warm_cutout_iter: dense_wide repeated with cutout width nudges',
    () => {
      // Warm the base + clipped caches, then iterate cutout widths so
      // base compounds hit cache but clipped results miss.
      getGenerateBin()(DENSE_WIDE);
      for (let i = 0; i < 4; i++) {
        const width = 68 - i;
        getGenerateBin()({
          ...DENSE_WIDE,
          walls: {
            ...DENSE_WIDE.walls,
            front: { ...DENSE_WIDE.walls.front, width },
            back: { ...DENSE_WIDE.walls.back, width },
            left: { ...DENSE_WIDE.walls.left, width },
            right: { ...DENSE_WIDE.walls.right, width },
          },
        });
      }
    },
    { iterations: 2, warmupIterations: 1 }
  );
});

// ─── Export paths ─────────────────────────────────────────────────────────────

describe('export (forExport=true)', () => {
  bench(
    '1×1 export fidelity',
    () => {
      getGenerateBin()(params({ width: 1, depth: 1, height: 3 }), undefined, true);
    },
    { iterations: 5, warmupIterations: 1 }
  );

  bench(
    '2×2 export fidelity',
    () => {
      getGenerateBin()(params({ width: 2, depth: 2, height: 3 }), undefined, true);
    },
    { iterations: 3, warmupIterations: 1 }
  );

  bench(
    '2×2 export + scoop + insert',
    () => {
      getGenerateBin()(
        params({
          width: 2,
          depth: 2,
          height: 3,
          scoop: { enabled: true, radius: 'auto' },
          inserts: [makeInsert({ shape: 'circle', width: 25, depth: 25, cutDepth: 5 })],
        }),
        undefined,
        true
      );
    },
    { iterations: 3, warmupIterations: 1 }
  );
});

// ─── Socket grid (cold cache) ───────────────────────────────────────────────
//
// The whole-socket cache isn't keyed on bin height, so end-to-end bin benches
// measure it warm after the first call. Clear all caches each iteration to time
// the cold socket-grid build itself (cell loft + fuse + hole cut) across grid
// sizes — the lever for any future socket-fuse change.
describe('socket grid (cold cache)', () => {
  // The clear must live INSIDE the timed fn: vitest's bench() ignores
  // tinybench's per-iteration beforeEach and runs setup/teardown only once per
  // phase, so a hook would clear once → first iteration cold, rest warm. Clearing
  // here keeps every iteration cold; the disposal cost is sub-ms vs the build.
  const cold = (gridW: number, gridD: number, magnet: boolean, forExport: boolean) => () => {
    clearAllCaches();
    buildBaseSocket(gridW, gridD, magnet, false, 3.1, 2, 1.25, forExport);
  };

  bench('4×4 preview', cold(4, 4, false, false), { iterations: 10, warmupIterations: 2 });
  bench('6×6 preview', cold(6, 6, false, false), { iterations: 10, warmupIterations: 2 });
  bench('7×7 preview', cold(7, 7, false, false), { iterations: 8, warmupIterations: 2 });
  bench('6×6 export', cold(6, 6, false, true), { iterations: 6, warmupIterations: 1 });
  bench('6×6 export + magnets', cold(6, 6, true, true), { iterations: 4, warmupIterations: 1 });
});
