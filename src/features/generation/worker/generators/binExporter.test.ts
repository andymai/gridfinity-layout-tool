// @vitest-environment node
/**
 * Regression tests for bin export quality guards.
 *
 * See GH #1339: `exportBin()` used to reuse whatever solid was cached as
 * `lastSolid` — including solids left behind by interactive preview passes.
 * A preview pass runs `mesh()` at coarse tolerance, which attaches
 * triangulation to the solid's faces. A subsequent `exportSTL()` call can
 * then reuse that stale coarse triangulation instead of re-meshing at export
 * tolerance, causing intermittent `STL_EXPORT_FAILED` errors. (Same class
 * of bug as the regression documented in `binGenerator.scenario.split-export.test.ts`.)
 *
 * These tests lock in the contract that `exportBin()` MUST regenerate the
 * solid with `forExport=true` whenever the cached solid is not marked as
 * export-quality — exercised against real brepjs/WASM, no mocks, per
 * CLAUDE.md's "real dependencies only" rule.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { exportBin } from './binExporter';
import { generateBin } from './binOrchestrator';
import { clearAllCaches, getLastSolid, isLastSolidExportQuality } from './shapeCache';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

/**
 * Footprint of an exported STL in whole grid units, read back from its bounding
 * box. Identifies WHICH design a buffer actually holds — byte length alone
 * would not catch two different designs that happen to tessellate similarly.
 */
function spanOf(stl: ArrayBuffer): { x: number; y: number } {
  const parsed = parseSTLBinary(stl);
  if (!isOk(parsed)) throw new Error('exported STL did not parse');
  const { vertices } = parsed.value;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < vertices.length; i += 3) {
    minX = Math.min(minX, vertices[i]);
    maxX = Math.max(maxX, vertices[i]);
    minY = Math.min(minY, vertices[i + 1]);
    maxY = Math.max(maxY, vertices[i + 1]);
  }
  const unit = DEFAULT_BIN_PARAMS.gridUnitMm;
  return { x: Math.round((maxX - minX) / unit), y: Math.round((maxY - minY) / unit) };
}

describe('exportBin: full-fidelity regeneration guard', () => {
  beforeEach(() => {
    clearAllCaches();
  });

  it('regenerates with forExport=true when cached solid is preview-quality', async () => {
    // Simulate an interactive preview pass leaving a preview-quality solid behind.
    generateBin(DEFAULT_BIN_PARAMS, undefined, false);
    expect(getLastSolid()).not.toBeNull();
    expect(isLastSolidExportQuality()).toBe(false);

    const result = await exportBin(DEFAULT_BIN_PARAMS, 'stl');

    // Regression for GH #1339: flag must flip from false→true, proving
    // setLastSolid was called again during an export-quality pipeline pass
    // (the only place that mutates the flag).
    expect(isLastSolidExportQuality()).toBe(true);
    // And STL write actually succeeded end-to-end on the regenerated solid.
    expect(result.data.byteLength).toBeGreaterThan(0);
    expect(result.fileName).toMatch(/\.stl$/);
  }, 60000);

  it('reuses the cached solid when it is already export-quality', async () => {
    // First export forces an export-quality regeneration.
    await exportBin(DEFAULT_BIN_PARAMS, 'stl');
    expect(isLastSolidExportQuality()).toBe(true);
    const cachedSolid = getLastSolid();

    // Second export should reuse the same Shape3D reference — no regen.
    const result = await exportBin(DEFAULT_BIN_PARAMS, 'stl');

    expect(getLastSolid()).toBe(cachedSolid);
    expect(result.data.byteLength).toBeGreaterThan(0);
  }, 60000);

  it('regenerates with full-fidelity when there is no cached solid', async () => {
    expect(getLastSolid()).toBeNull();

    const result = await exportBin(DEFAULT_BIN_PARAMS, 'stl');

    expect(isLastSolidExportQuality()).toBe(true);
    expect(getLastSolid()).not.toBeNull();
    expect(result.data.byteLength).toBeGreaterThan(0);
  }, 60000);

  it('retries once after first attempt fails on a corrupted cached solid', async () => {
    // Generate a real export-quality solid, then corrupt the cache by
    // disposing the Shape3D handle while leaving the export-quality flag
    // true. This simulates the class of failure the retry path exists
    // for: cached solid in an unusable state that regeneration recovers.
    const firstResult = await exportBin(DEFAULT_BIN_PARAMS, 'stl');
    expect(firstResult.data.byteLength).toBeGreaterThan(0);

    const cachedSolid = getLastSolid();
    expect(cachedSolid).not.toBeNull();
    // Dispose the underlying WASM handle without clearing lastSolid/flag.
    // The next export attempt will try to use a dead handle and throw.
    cachedSolid?.delete();
    // Flag is still true — exportBin will skip the quality regen check,
    // hit the dead handle on the first attempt, then retry after
    // setLastSolid(null) clears the cache.

    const result = await exportBin(DEFAULT_BIN_PARAMS, 'stl');

    // Retry must succeed end-to-end and leave the cache in a healthy state.
    expect(result.data.byteLength).toBeGreaterThan(0);
    expect(result.fileName).toMatch(/\.stl$/);
    expect(isLastSolidExportQuality()).toBe(true);
    expect(getLastSolid()).not.toBeNull();
  }, 60000);

  it('regenerates when the cached export-quality solid is a different design', async () => {
    // GH #3074: a whole-layout export runs many designs through one worker
    // back to back with no preview pass in between, so every design after the
    // first met an export-quality cached solid — and shipped its predecessor's
    // geometry under its own filename.
    const small = { ...DEFAULT_BIN_PARAMS, width: 1, depth: 1 };
    const large = { ...DEFAULT_BIN_PARAMS, width: 3, depth: 2 };

    const smallStl = await exportBin(small, 'stl');
    const largeStl = await exportBin(large, 'stl');

    // Asserting on geometry rather than the cached Shape3D reference: the
    // regeneration disposes the previous handle, so touching it here would
    // throw instead of failing with a useful message.
    expect(spanOf(smallStl.data)).toEqual({ x: 1, y: 1 });
    expect(spanOf(largeStl.data)).toEqual({ x: 3, y: 2 });
  }, 90000);

  it('STEP export also regenerates when cache is preview-quality', async () => {
    generateBin(DEFAULT_BIN_PARAMS, undefined, false);
    expect(isLastSolidExportQuality()).toBe(false);

    const result = await exportBin(DEFAULT_BIN_PARAMS, 'step');

    expect(isLastSolidExportQuality()).toBe(true);
    expect(result.data.byteLength).toBeGreaterThan(0);
    expect(result.fileName).toMatch(/\.step$/);
  }, 60000);
});
