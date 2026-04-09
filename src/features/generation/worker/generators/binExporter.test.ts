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
import { initBrepjs } from './__dual-kernel__/wasmInit';
import { exportBin } from './binExporter';
import { generateBin } from './binOrchestrator';
import { clearAllCaches, getLastSolid, isLastSolidExportQuality } from './shapeCache';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

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

  it('STEP export also regenerates when cache is preview-quality', async () => {
    generateBin(DEFAULT_BIN_PARAMS, undefined, false);
    expect(isLastSolidExportQuality()).toBe(false);

    const result = await exportBin(DEFAULT_BIN_PARAMS, 'step');

    expect(isLastSolidExportQuality()).toBe(true);
    expect(result.data.byteLength).toBeGreaterThan(0);
    expect(result.fileName).toMatch(/\.step$/);
  }, 60000);
});
