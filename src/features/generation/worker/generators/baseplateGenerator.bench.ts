// @vitest-environment node
/**
 * Vitest benchmarks for baseplate generation.
 *
 * Measures generation time with statistical iterations for reliable
 * cross-kernel comparison. Run with:
 *
 *   pnpm exec vitest bench baseplateGenerator
 *   BREPJS_KERNEL=wasm pnpm exec vitest bench baseplateGenerator
 *
 * NOTE: generateBaseplate() has an aggressive LRU mesh cache. Each bench
 * call uses a unique paddingLeft value to ensure a full cache miss and
 * real BREP + tessellation work on every iteration.
 */
import { bench, describe, beforeAll } from 'vitest';
import type { BaseplateParams } from '@/shared/types/bin';
import { initBrepjs, getGenerateBaseplate } from './__kernel-tests__/wasmInit';
import { clearBaseplateCaches } from './baseplateCaches';

const noop = (): void => {};

// Monotonic counter to defeat the mesh result LRU cache.
// Each call gets a unique paddingLeft value (0.0001, 0.0002, …)
// which changes the cache key but has negligible effect on geometry.
let callCounter = 0;

const defaults = (overrides: Partial<BaseplateParams> = {}): BaseplateParams => ({
  width: 2,
  depth: 2,
  gridUnitMm: 42,
  magnetHoles: false,
  magnetDiameter: 6.5,
  magnetDepth: 2.4,
  paddingLeft: ++callCounter * 0.0001,
  paddingRight: 0,
  paddingFront: 0,
  paddingBack: 0,
  fractionalEdgeX: 'end',
  fractionalEdgeY: 'end',
  ...overrides,
});

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

describe('baseplate generation', () => {
  bench(
    '2×2 no magnets',
    () => {
      getGenerateBaseplate()(defaults(), noop, false);
    },
    { iterations: 5, warmupIterations: 1 }
  );

  bench(
    '4×4 no magnets',
    () => {
      getGenerateBaseplate()(defaults({ width: 4, depth: 4 }), noop, false);
    },
    { iterations: 5, warmupIterations: 1 }
  );

  bench(
    '4×4 with magnets',
    () => {
      getGenerateBaseplate()(defaults({ width: 4, depth: 4, magnetHoles: true }), noop, false);
    },
    { iterations: 3, warmupIterations: 1 }
  );

  bench(
    '6×4 magnets (stress)',
    () => {
      getGenerateBaseplate()(defaults({ width: 6, depth: 4, magnetHoles: true }), noop, false);
    },
    { iterations: 3, warmupIterations: 1 }
  );

  bench(
    '6×6 magnets (split-piece)',
    () => {
      getGenerateBaseplate()(defaults({ width: 6, depth: 6, magnetHoles: true }), noop, false);
    },
    { iterations: 3, warmupIterations: 1 }
  );

  bench(
    '3×3 magnets + connectors',
    () => {
      getGenerateBaseplate()(
        defaults({
          width: 3,
          depth: 3,
          magnetHoles: true,
          connectorNubs: true,
          edges: { left: 'join', right: 'join', front: 'exterior', back: 'exterior' },
        }),
        noop,
        false
      );
    },
    { iterations: 3, warmupIterations: 1 }
  );

  // Large-plate cold builds. The unique-paddingLeft cache-defeat above
  // quantizes away for these, so clear the baseplate caches each iteration to
  // time the real cold pocket cut across grid sizes; no magnets ⇒ through-cut.
  // The clear must live INSIDE the timed fn — vitest's bench() ignores
  // tinybench's per-iteration beforeEach and runs setup once per phase, so a
  // hook would leave every iteration after the first warm.
  const coldPlate = (w: number, d: number, forExport: boolean) => () => {
    clearBaseplateCaches();
    getGenerateBaseplate()(defaults({ width: w, depth: d }), noop, forExport);
  };

  bench('6×6 no magnets (cold)', coldPlate(6, 6, false), { iterations: 4, warmupIterations: 1 });
  bench('8×8 no magnets (cold)', coldPlate(8, 8, false), { iterations: 3, warmupIterations: 1 });
  bench('12×12 no magnets (cold)', coldPlate(12, 12, false), {
    iterations: 2,
    warmupIterations: 1,
  });
  bench('8×8 export (cold)', coldPlate(8, 8, true), { iterations: 2, warmupIterations: 1 });
});
