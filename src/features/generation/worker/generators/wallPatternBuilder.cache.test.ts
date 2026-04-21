/**
 * Cache-split regression test for wallPatternBuilder (#1422 follow-up).
 *
 * Wall patterns generate hundreds of hex prisms per wall; before the split,
 * the cache key bundled cutout/handle/ramp clip parameters together with the
 * wall's hex layout. Every cutout-slider nudge invalidated all four walls and
 * forced a full rebuild (`transformCopy` + `compound` + `cut`), which pushed
 * long bins past the 30s generation timeout.
 *
 * The builder now keeps a separate cache layer for the uncut "base" compound.
 * Changing only cutout parameters must hit the base cache and re-run only the
 * cheap clip pass — this test pins that behaviour via cache-stat assertions
 * so the fix can't silently regress.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from '@/shared/constants/bin';
import { initBrepjs, getGenerateBin } from './__dual-kernel__/wasmInit';
import { clearAllCaches, getAllShapeCacheStats, resetAllShapeCacheStats } from './shapeCache';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

beforeEach(() => {
  clearAllCaches();
  resetAllShapeCacheStats();
});

function getStats(name: string) {
  const stats = getAllShapeCacheStats().find((s) => s.name === name);
  return stats ?? { name, hits: 0, misses: 0, evictions: 0, size: 0, maxSize: 0 };
}

const HONEYCOMB_2x2x4 = {
  ...DEFAULT_BIN_PARAMS,
  width: 2,
  depth: 2,
  height: 4,
  wallPattern: { enabled: true, pattern: 'honeycomb' as const },
  walls: {
    ...DEFAULT_BIN_PARAMS.walls,
    enabled: true,
    front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
    back: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
    left: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
    right: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
    interior: DISABLED_WALL_CUTOUT,
  },
};

describe('wallPatternBuilder cache split', () => {
  it('reuses the base hex compound when only cutout params change', () => {
    const generateBin = getGenerateBin();

    // First run: populate caches with 70%-wide cutouts on all four sides.
    generateBin(HONEYCOMB_2x2x4);

    const baseAfterFirst = getStats('feature-wallPatternBase');
    const clippedAfterFirst = getStats('feature-wallPatternClipped');

    expect(baseAfterFirst.misses, 'first gen should miss the base cache once per wall').toBe(4);
    expect(clippedAfterFirst.misses, 'first gen should miss the clipped cache once per wall').toBe(
      4
    );

    resetAllShapeCacheStats();

    // Second run: nudge cutout width from 70 -> 60 on every side.
    // This changes the clip solid but NOT the hex layout, so the base
    // compound cache should hit on every wall while the clipped cache misses.
    const nudged = {
      ...HONEYCOMB_2x2x4,
      walls: {
        ...HONEYCOMB_2x2x4.walls,
        front: { ...HONEYCOMB_2x2x4.walls.front, width: 60 },
        back: { ...HONEYCOMB_2x2x4.walls.back, width: 60 },
        left: { ...HONEYCOMB_2x2x4.walls.left, width: 60 },
        right: { ...HONEYCOMB_2x2x4.walls.right, width: 60 },
      },
    };
    generateBin(nudged);

    const baseAfterSecond = getStats('feature-wallPatternBase');
    const clippedAfterSecond = getStats('feature-wallPatternClipped');

    expect(baseAfterSecond.hits, 'cutout-only nudge must reuse base compound for every wall').toBe(
      4
    );
    expect(baseAfterSecond.misses, 'cutout-only nudge must not rebuild any base compound').toBe(0);
    expect(
      clippedAfterSecond.misses,
      'cutout-only nudge must produce a fresh clipped result per wall'
    ).toBe(4);
  }, 60_000);

  it('reuses the fully-clipped cache when nothing changes', () => {
    const generateBin = getGenerateBin();

    generateBin(HONEYCOMB_2x2x4);
    resetAllShapeCacheStats();
    generateBin(HONEYCOMB_2x2x4);

    const clipped = getStats('feature-wallPatternClipped');
    expect(clipped.hits, 'identical re-gen must hit the clipped cache per wall').toBe(4);
    expect(clipped.misses, 'identical re-gen must not rebuild clipped shapes').toBe(0);
  }, 60_000);
});
