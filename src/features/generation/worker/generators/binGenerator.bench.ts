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
