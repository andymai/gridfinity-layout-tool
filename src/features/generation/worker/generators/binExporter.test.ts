/**
 * Regression tests for bin export quality guards.
 *
 * See GH #1339: `exportBin()` used to reuse whatever solid was cached as
 * `lastSolid` — including preview-quality solids left behind by interactive
 * rendering. Preview solids use a simplified socket profile that can cause
 * intermittent `STL_EXPORT_FAILED` errors in brepjs's STL writer.
 *
 * These tests lock in the contract that `exportBin()` MUST regenerate the
 * solid with `forExport=true` whenever the cached solid is not marked as
 * export-quality.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BinParams } from '@/shared/types/bin';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';

// Mock brepjs export primitives so we don't need WASM. Return a dummy Blob.
vi.mock('brepjs', () => ({
  unwrap: vi.fn((v) => v),
  exportSTL: vi.fn(() => new Blob([new Uint8Array([1, 2, 3, 4])])),
  exportSTEP: vi.fn(() => new Blob([new Uint8Array([5, 6, 7, 8])])),
}));

// Mock the orchestrator: each call seeds the shape cache with a fake solid
// tagged by the forExport flag it was invoked with.
const generateBinMock =
  vi.fn<(params: BinParams, onProgress: undefined, forExport: boolean) => unknown>();
vi.mock('./binOrchestrator', () => ({
  generateBin: (params: BinParams, onProgress: undefined, forExport: boolean) =>
    generateBinMock(params, onProgress, forExport),
}));

// Import after mocks so the SUT binds to the mocked modules.
import { exportBin } from './binExporter';
import { setLastSolid, getLastSolid, isLastSolidExportQuality } from './shapeCache';
import type { Shape3D } from 'brepjs';

function fakeSolid(tag: string): Shape3D {
  return { __tag: tag, delete: vi.fn() } as unknown as Shape3D;
}

describe('exportBin: full-fidelity regeneration guard', () => {
  beforeEach(() => {
    generateBinMock.mockReset();
    // Default behaviour: orchestrator populates the cache with an export-grade solid.
    generateBinMock.mockImplementation((_params, _onProgress, forExport) => {
      setLastSolid(fakeSolid('regenerated'), forExport);
      return {
        vertices: new Float32Array(),
        normals: new Float32Array(),
        indices: new Uint32Array(),
        edgeVertices: new Float32Array(),
        triangleCount: 0,
        faceGroups: [],
      };
    });
    // Start each test with no cached solid.
    setLastSolid(null);
  });

  it('regenerates with forExport=true when cached solid is preview-quality', async () => {
    // Simulate an interactive preview pass leaving a preview-quality solid behind.
    setLastSolid(fakeSolid('preview'), false);
    expect(isLastSolidExportQuality()).toBe(false);

    await exportBin(DEFAULT_BIN_PARAMS, 'stl');

    // Regression for GH #1339: must not reuse the preview solid.
    expect(generateBinMock).toHaveBeenCalledTimes(1);
    expect(generateBinMock).toHaveBeenCalledWith(DEFAULT_BIN_PARAMS, undefined, true);
    expect(isLastSolidExportQuality()).toBe(true);
  });

  it('reuses the cached solid when it is already export-quality', async () => {
    setLastSolid(fakeSolid('already-export'), true);
    expect(isLastSolidExportQuality()).toBe(true);
    const cachedBefore = getLastSolid();

    await exportBin(DEFAULT_BIN_PARAMS, 'stl');

    expect(generateBinMock).not.toHaveBeenCalled();
    // The cached solid should still be the same reference (not replaced).
    expect(getLastSolid()).toBe(cachedBefore);
  });

  it('regenerates when there is no cached solid at all', async () => {
    expect(getLastSolid()).toBeNull();

    await exportBin(DEFAULT_BIN_PARAMS, 'stl');

    expect(generateBinMock).toHaveBeenCalledTimes(1);
    expect(generateBinMock).toHaveBeenCalledWith(DEFAULT_BIN_PARAMS, undefined, true);
  });

  it('throws a clear error when regeneration does not produce a solid', async () => {
    // Orchestrator runs but never populates the cache.
    generateBinMock.mockImplementation(() => ({
      vertices: new Float32Array(),
      normals: new Float32Array(),
      indices: new Uint32Array(),
      edgeVertices: new Float32Array(),
      triangleCount: 0,
      faceGroups: [],
    }));

    await expect(exportBin(DEFAULT_BIN_PARAMS, 'stl')).rejects.toThrow(
      'Failed to generate solid for export'
    );
  });

  it('STEP export also regenerates when cache is preview-quality', async () => {
    setLastSolid(fakeSolid('preview'), false);

    await exportBin(DEFAULT_BIN_PARAMS, 'step');

    expect(generateBinMock).toHaveBeenCalledWith(DEFAULT_BIN_PARAMS, undefined, true);
  });
});
