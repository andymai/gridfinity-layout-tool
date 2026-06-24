// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import { clearAllCaches, resetAllShapeCacheStats, getAllShapeCacheStats } from './shapeCache';

const binBodyStats = (): { hits: number; misses: number } => {
  const s = getAllShapeCacheStats().find((c) => c.name === 'bin-body');
  return { hits: s?.hits ?? 0, misses: s?.misses ?? 0 };
};

describe('post-boolean body resume cache (#2333)', () => {
  beforeAll(async () => {
    await initBrepjs();
  }, 30_000);

  it('skips the boolean on an identical re-generation and keeps geometry identical', () => {
    const generateBin = getGenerateBin();
    // Label-bracket tabs are additive fuse targets, so the boolean stage runs.
    const params = buildParams({
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'bracket', alignment: 'left' },
    });

    clearAllCaches();
    resetAllShapeCacheStats();

    const first = generateBin(params, undefined, false);
    expect(binBodyStats()).toEqual({ hits: 0, misses: 1 }); // cold: boolean ran, body cached

    const second = generateBin(params, undefined, false);
    expect(binBodyStats().hits).toBe(1); // boolean stage skipped via resume cache
    // Identical inputs ⇒ identical output.
    expect(second.triangleCount).toBe(first.triangleCount);
    expect(second.vertices.length).toBe(first.vertices.length);
  }, 60_000);

  it('keys export and preview bodies separately (forExport drives simplify)', () => {
    const generateBin = getGenerateBin();
    const params = buildParams({
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'bracket', alignment: 'left' },
    });

    clearAllCaches();
    resetAllShapeCacheStats();

    generateBin(params, undefined, false); // preview → miss
    generateBin(params, undefined, true); // export → separate key, miss (not a false hit)
    expect(binBodyStats()).toEqual({ hits: 0, misses: 2 });
  }, 60_000);

  it('disables the resume cache for wall-pattern bins (featuresKey null)', () => {
    const generateBin = getGenerateBin();
    const params = buildParams({
      wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true },
    });

    clearAllCaches();
    resetAllShapeCacheStats();

    generateBin(params, undefined, false);
    generateBin(params, undefined, false);
    // No bin-body cache activity at all — the resume path never engages.
    expect(binBodyStats()).toEqual({ hits: 0, misses: 0 });
  }, 60_000);
});
