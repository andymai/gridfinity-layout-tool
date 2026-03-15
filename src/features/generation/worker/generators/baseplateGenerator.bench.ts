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
import { initBrepjs, getGenerateBaseplate } from './__dual-kernel__/wasmInit';

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
});
