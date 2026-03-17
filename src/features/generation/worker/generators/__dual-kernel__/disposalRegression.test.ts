/**
 * WASM disposal regression tests.
 *
 * Verifies that explicit `.delete()` cleanup in shape caches keeps cached
 * handle counts bounded and prevents cache-managed shapes from leaking to
 * the FinalizationRegistry (GC safety net).
 *
 * Note: The generation pipeline also creates intermediate ShapeHandle objects
 * (from extrude, fillet, fuse, cut, etc.) that are not cache-managed. Those
 * handles still rely on FinalizationRegistry until the pipeline is refactored
 * to use DisposalScope. These tests focus on the cache layer specifically.
 *
 * Requires real brepjs WASM — excluded from default CI via __dual-kernel__ path.
 *
 * Run:
 *   pnpm exec vitest run --config vitest.profile.config.ts __dual-kernel__/disposalRegression
 */
// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { getDisposalStats, resetDisposalStats } from 'brepjs';
import { initBrepjs, getGenerateBin } from './wasmInit';
import { buildParams } from './scenarioTypes';
import { clearAllCaches } from '../shapeCache';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

beforeEach(() => {
  clearAllCaches();
  resetDisposalStats();
});

describe('WASM disposal regression', () => {
  it('liveHandles stays bounded after 10 generation cycles', () => {
    const generateBin = getGenerateBin();

    // Generate with varying grid sizes to force cache evictions (LRU capacity = 5)
    for (let i = 0; i < 10; i++) {
      const gridW = 1 + (i % 4); // cycles through 1-4
      const gridD = 1 + ((i + 1) % 3); // cycles through 1-3
      const params = buildParams({ gridW, gridD });
      generateBin(params);
    }

    const stats5 = getDisposalStats();

    // Run 10 more cycles — handle count should not grow linearly
    for (let i = 10; i < 20; i++) {
      const gridW = 1 + (i % 4);
      const gridD = 1 + ((i + 1) % 3);
      const params = buildParams({ gridW, gridD });
      generateBin(params);
    }

    const stats10 = getDisposalStats();

    // If caches weren't disposing evicted shapes, liveHandles would grow ~linearly.
    // With disposal, repeated param combinations hit cache and handle count plateaus.
    // Allow 20% growth tolerance (intermediate pipeline shapes may vary slightly).
    expect(stats10.liveHandles).toBeLessThan(stats5.liveHandles * 1.2 + 20);
  }, 120_000);

  it('clearAllCaches reduces liveHandles', () => {
    const generateBin = getGenerateBin();

    // Generate with several different params to populate all cache types
    for (let gridW = 1; gridW <= 5; gridW++) {
      generateBin(buildParams({ gridW, gridD: 1 }));
    }

    const beforeClear = getDisposalStats();
    expect(beforeClear.liveHandles).toBeGreaterThan(0);

    clearAllCaches();

    const afterClear = getDisposalStats();
    // Caches should have freed handles on disposal
    expect(afterClear.liveHandles).toBeLessThan(beforeClear.liveHandles);
    expect(afterClear.gcCollected).toBe(0);
  }, 120_000);

  it('cache eviction disposes shapes without GC', () => {
    const generateBin = getGenerateBin();

    // Generate with 7 different shell keys to exceed LRU(5) and trigger evictions
    for (let gridW = 1; gridW <= 7; gridW++) {
      generateBin(buildParams({ gridW, gridD: 1 }));
    }

    const stats = getDisposalStats();
    // Evicted shapes should have been explicitly disposed, not GC'd
    expect(stats.gcCollected).toBe(0);
  }, 120_000);
});
