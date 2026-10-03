// @vitest-environment node
/**
 * Kumiko cutter cache correctness: the per-slab base and clipped cache
 * entries must reproduce identical geometry on a warm re-generation, both
 * with and without clip compositions.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from '@/shared/constants/bin';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import { clearAllCaches, getAllShapeCacheStats } from './shapeCache';

const KUMIKO_ON = {
  ...DEFAULT_BIN_PARAMS.wallPattern,
  enabled: true,
  pattern: 'mitsukude',
} as const;

describe('kumiko wrap cutter caches', () => {
  beforeAll(async () => {
    await initBrepjs();
  }, 120_000);

  it('reproduces identical geometry from warm per-slab caches', () => {
    const generateBin = getGenerateBin();
    const params = buildParams({ width: 1, depth: 1, height: 6, wallPattern: KUMIKO_ON });

    clearAllCaches();
    const cold = generateBin(params, undefined, false);
    const warm = generateBin(params, undefined, false);

    expect(warm.triangleCount).toBe(cold.triangleCount);
    expect(warm.vertices.length).toBe(cold.vertices.length);
  }, 120_000);

  it('reproduces identical geometry from warm caches with clips applied', () => {
    const generateBin = getGenerateBin();
    const params = buildParams({
      width: 2,
      depth: 1,
      height: 6,
      wallPattern: KUMIKO_ON,
      walls: {
        ...DEFAULT_BIN_PARAMS.walls,
        enabled: true,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 60, depth: 50 },
      },
    });

    clearAllCaches();
    const cold = generateBin(params, undefined, false);
    const warm = generateBin(params, undefined, false);

    expect(warm.triangleCount).toBe(cold.triangleCount);
    expect(warm.vertices.length).toBe(cold.vertices.length);
  }, 180_000);

  it('rebuilds when the pattern scale changes (cache keys diverge)', () => {
    const generateBin = getGenerateBin();
    clearAllCaches();
    const neutral = generateBin(
      buildParams({ width: 1, depth: 1, height: 6, wallPattern: KUMIKO_ON }),
      undefined,
      false
    );
    const bold = generateBin(
      buildParams({
        width: 1,
        depth: 1,
        height: 6,
        wallPattern: { ...KUMIKO_ON, scale: 1 },
      }),
      undefined,
      false
    );
    expect(bold.triangleCount).not.toBe(neutral.triangleCount);
  }, 180_000);

  it('serves a warm regen from cache when the cutter count is large', () => {
    // A 3x3 asanoha fill plans well over a hundred cutters, more than a
    // per-shape LRU holds, so only a whole-set entry survives to be read back.
    const generateBin = getGenerateBin();
    const params = buildParams({
      width: 3,
      depth: 3,
      height: 6,
      wallPattern: { ...KUMIKO_ON, pattern: 'asanoha', scale: 0.5 },
    });
    const baseHits = (): number =>
      getAllShapeCacheStats().find((s) => s.name === 'set-kumikoWrapBase')?.hits ?? 0;

    clearAllCaches();
    const cold = generateBin(params, undefined, false);
    const hitsBefore = baseHits();
    const warm = generateBin(params, undefined, false);

    expect(baseHits()).toBe(hitsBefore + 1);
    expect(warm.triangleCount).toBe(cold.triangleCount);
    expect(Array.from(warm.vertices)).toEqual(Array.from(cold.vertices));
  }, 300_000);
});
