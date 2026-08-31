/**
 * Resume-cache coverage for wall-patterned bins.
 *
 * The post-boolean `bin-body` cache lets a re-generation skip the boolean stage
 * when the shell and every feature's geometry key are unchanged. Patterned bins
 * used to be excluded from it wholesale (`featuresStage` nulled `featuresKey`
 * whenever a wall pattern was on), which is backwards: honeycomb-plus-cutout
 * bins are the slowest bins to boolean, so they are exactly the ones that most
 * need to skip it.
 *
 * They now ride in `featuresKey` via the per-wall identity the pattern cache
 * already trusts. The risk that buys is a stale body, so the misses matter more
 * than the hits here: every parameter that changes pattern geometry must still
 * miss.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from '@/shared/constants/bin';
import { DEFAULT_FLOOR_PATTERN_CONFIG } from '@/shared/types/bin';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { clearAllCaches, getAllShapeCacheStats, resetAllShapeCacheStats } from './shapeCache';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

beforeEach(() => {
  clearAllCaches();
  resetAllShapeCacheStats();
});

function binBodyStats() {
  const stats = getAllShapeCacheStats().find((s) => s.name === 'bin-body');
  return stats ?? { name: 'bin-body', hits: 0, misses: 0, evictions: 0, size: 0, maxSize: 0 };
}

const fourCutouts = (width: number) => ({
  ...DEFAULT_BIN_PARAMS.walls,
  enabled: true,
  front: { ...DISABLED_WALL_CUTOUT, enabled: true, width, depth: 50 },
  back: { ...DISABLED_WALL_CUTOUT, enabled: true, width, depth: 50 },
  left: { ...DISABLED_WALL_CUTOUT, enabled: true, width, depth: 50 },
  right: { ...DISABLED_WALL_CUTOUT, enabled: true, width, depth: 50 },
  interior: DISABLED_WALL_CUTOUT,
});

const HONEYCOMB = {
  ...DEFAULT_BIN_PARAMS,
  width: 2,
  depth: 2,
  height: 4,
  wallPattern: { enabled: true, pattern: 'honeycomb' as const },
  walls: fourCutouts(70),
};

describe('bin-body resume cache with wall patterns', () => {
  it('resumes the booleaned body when a patterned bin is regenerated unchanged', () => {
    const generateBin = getGenerateBin();

    const first = generateBin(HONEYCOMB);
    resetAllShapeCacheStats();
    const second = generateBin(HONEYCOMB);

    expect(binBodyStats().hits, 'identical re-gen of a patterned bin must resume the body').toBe(1);
    expect(second.triangleCount).toBe(first.triangleCount);
  }, 120_000);

  it('rebuilds rather than resuming when a cutout width changes', () => {
    const generateBin = getGenerateBin();

    const first = generateBin(HONEYCOMB);
    resetAllShapeCacheStats();
    const nudged = generateBin({ ...HONEYCOMB, walls: fourCutouts(60) });

    const stats = binBodyStats();
    expect(stats.hits, 'a wider cutout is different geometry and must not resume').toBe(0);
    expect(stats.misses).toBe(1);
    expect(nudged.triangleCount).not.toBe(first.triangleCount);
  }, 120_000);

  it('rebuilds rather than resuming when the pattern type changes', () => {
    const generateBin = getGenerateBin();

    generateBin(HONEYCOMB);
    resetAllShapeCacheStats();
    generateBin({ ...HONEYCOMB, wallPattern: { enabled: true, pattern: 'diamond' as const } });

    expect(binBodyStats().hits, 'a different pattern must not resume the honeycomb body').toBe(0);
  }, 120_000);

  it('rebuilds rather than resuming when the pattern is switched off', () => {
    const generateBin = getGenerateBin();

    const patterned = generateBin(HONEYCOMB);
    resetAllShapeCacheStats();
    const plain = generateBin({
      ...HONEYCOMB,
      wallPattern: { enabled: false, pattern: 'honeycomb' as const },
    });

    expect(binBodyStats().hits, 'an unpatterned bin must not resume a patterned body').toBe(0);
    expect(plain.triangleCount).not.toBe(patterned.triangleCount);
  }, 120_000);

  it('resumes the booleaned body for a floor-patterned bin', () => {
    // The floor pattern reports its identity, so an unchanged regen resumes the
    // body. Its shapes also carve the deferred socket, but booleanStage
    // re-derives that carve from the same shapes on every build, so the resumed
    // body and the freshly cut socket stay consistent.
    const generateBin = getGenerateBin();
    const withFloor = {
      ...HONEYCOMB,
      wallPattern: { enabled: false, pattern: 'honeycomb' as const },
      floorPattern: {
        ...DEFAULT_FLOOR_PATTERN_CONFIG,
        enabled: true,
        pattern: 'honeycomb' as const,
      },
    };

    const first = generateBin(withFloor);
    resetAllShapeCacheStats();
    const second = generateBin(withFloor);

    expect(
      binBodyStats().hits,
      'identical re-gen of a floor-patterned bin must resume the body'
    ).toBe(1);
    expect(second.triangleCount).toBe(first.triangleCount);
  }, 120_000);

  it('rebuilds rather than resuming when the floor pattern changes', () => {
    const generateBin = getGenerateBin();
    const withFloor = {
      ...HONEYCOMB,
      wallPattern: { enabled: false, pattern: 'honeycomb' as const },
      floorPattern: {
        ...DEFAULT_FLOOR_PATTERN_CONFIG,
        enabled: true,
        pattern: 'honeycomb' as const,
      },
    };

    const first = generateBin(withFloor);
    resetAllShapeCacheStats();
    const changed = generateBin({
      ...withFloor,
      floorPattern: { ...DEFAULT_FLOOR_PATTERN_CONFIG, enabled: true, pattern: 'diamond' as const },
    });

    expect(binBodyStats().hits, 'a different floor pattern must not resume').toBe(0);
    expect(changed.triangleCount).not.toBe(first.triangleCount);
  }, 120_000);
});
