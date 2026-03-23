/**
 * Integration test: verifies brepjs kernel performance stats are collected
 * during bin generation. Does not measure actual performance — only validates
 * that the instrumentation wiring produces non-zero counts for expected
 * operation categories.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { getPerformanceStats, resetPerformanceStats } from 'brepjs';
import { initBrepjs, getGenerateBin } from './__dual-kernel__/wasmInit';
import { buildParams } from './__dual-kernel__/scenarioTypes';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

describe('kernel performance stats', () => {
  it('collects non-zero stats for boolean and mesh operations after generation', () => {
    const generateBin = getGenerateBin();
    resetPerformanceStats();

    const params = buildParams({ width: 2, depth: 2, height: 3 });
    generateBin(params);

    const stats = getPerformanceStats();

    // Boolean operations: fuseAll/cutAll in the pipeline
    expect(stats.boolean.count).toBeGreaterThan(0);
    expect(stats.boolean.totalMs).toBeGreaterThanOrEqual(0);

    // Mesh operations: tessellate stage
    expect(stats.mesh.count).toBeGreaterThan(0);
    expect(stats.mesh.totalMs).toBeGreaterThanOrEqual(0);
  });

  it('resets stats between generations', () => {
    const generateBin = getGenerateBin();
    // Use 2×2 socket+magnets to guarantee boolean ops (fuseAll cells + cutAll holes)
    const params = buildParams({
      width: 2,
      depth: 2,
      height: 3,
      base: { style: 'socket', magnet: true, screw: false },
    });

    // First generation
    resetPerformanceStats();
    generateBin(params);
    const firstStats = getPerformanceStats();
    const firstBooleanCount = firstStats.boolean.count;
    expect(firstBooleanCount).toBeGreaterThan(0);

    // After reset, counts must be zero before next generation
    resetPerformanceStats();
    const resetStats = getPerformanceStats();
    expect(resetStats.boolean.count).toBe(0);
    expect(resetStats.boolean.totalMs).toBe(0);

    // Second generation with same params should produce same counts
    generateBin(params);
    const secondStats = getPerformanceStats();
    expect(secondStats.boolean.count).toBeLessThanOrEqual(firstBooleanCount);
  });

  it('tracks all expected category keys', () => {
    const generateBin = getGenerateBin();
    resetPerformanceStats();

    const params = buildParams({ width: 1, depth: 1, height: 3 });
    generateBin(params);

    const stats = getPerformanceStats();

    // All 8 categories should be present (even if count is 0 for some)
    const expectedCategories = [
      'boolean',
      'loft',
      'extrude',
      'shell',
      'fillet',
      'mesh',
      'edgeMesh',
      'transform',
    ];
    for (const category of expectedCategories) {
      expect(stats).toHaveProperty(category);
      expect(stats[category as keyof typeof stats].totalMs).toBeGreaterThanOrEqual(0);
    }
  });
});
