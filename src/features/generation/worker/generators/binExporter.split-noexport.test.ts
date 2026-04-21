// @vitest-environment node
/**
 * Regression tests for STL export failure on split bins when the
 * "split pieces" checkbox is unchecked.
 *
 * Bug: When the split preview is generated (useSplitPreview fires on the
 * worker), splitSolidIntoPieces calls generateBin(bodyParams, …, true)
 * with bodyParams that may differ from the user's actual params (e.g.
 * stackingLip is stripped for the body pass). This leaves lastSolid set
 * to the body solid and marks isLastSolidExportQuality = true. If the user
 * then exports without split (unchecks the checkbox), exportBin sees the
 * export-quality flag, skips regeneration, and attempts to write the cached
 * body solid via exportSTL. Because the body solid's faces may carry stale
 * or mixed tessellation state from the split-preview boolean operations, the
 * brepjs hasTriangulation check returns true (finds at least one tessellated
 * face), meshShape is skipped, and StlAPI.Write fails with
 * "STL export failed: StlAPI.Write returned false" → user sees
 * "Failed to write STL file" error toast.
 *
 * The fix ensures exportBin always produces a valid STL even when the
 * cached lastSolid was produced by the split preview path.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { DEFAULT_BIN_PARAMS, GRIDFINITY } from '@/shared/constants/bin';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { BinParams } from '@/shared/types/bin';
import { initBrepjs } from './__dual-kernel__/wasmInit';
import { exportBin } from './binExporter';
import { generateSplitPreview } from './splitBinBuilder';
import { clearAllCaches, isLastSolidExportQuality } from './shapeCache';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { isOk } from '@/core/result';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

const GRID_UNIT = GRIDFINITY.GRID_SIZE; // 42 mm
// Use a bin wide enough to require a split on a 4-unit max bed (4 × 42 = 168 mm).
const SPLIT_WIDTH = 6; // 6 units — needs 2 pieces on a 4-unit max bed
const CUT_PLANES_X = [0]; // single cut at center
const CONNECTORS_OFF = { ...DEFAULT_SPLIT_CONNECTOR_CONFIG, enabled: false };

/** Compute axis-aligned bounding box from interleaved [x,y,z,...] vertices. */
function getVertexBounds(vertices: Float32Array): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
} {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i];
    const y = vertices[i + 1];
    const z = vertices[i + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { minX, maxX, minY, maxY, minZ, maxZ };
}

describe('exportBin after generateSplitPreview: STL write must succeed', () => {
  beforeEach(() => {
    clearAllCaches();
  });

  it('exports successfully after split preview — no stacking lip', async () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: SPLIT_WIDTH,
      depth: 2,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    };

    // Simulate what useSplitPreview does: generate the split preview.
    // Internally this calls generateBin(bodyParams, …, true) and leaves
    // lastSolid pointing at the body solid.
    generateSplitPreview(params, CUT_PLANES_X, [], CONNECTORS_OFF);

    // After the fix: split preview marks the solid as NOT export-quality,
    // forcing exportBin to regenerate with the correct full params.
    expect(isLastSolidExportQuality()).toBe(false);

    // Now simulate the user exporting without split (checkbox unchecked).
    // This was previously failing with "Failed to write STL file".
    const result = await exportBin(params, 'stl');

    expect(result.data.byteLength).toBeGreaterThan(0);
    expect(result.fileName).toMatch(/\.stl$/);
  }, 90000);

  it('exports successfully after split preview — with stacking lip', async () => {
    // Bins with stackingLip=true are the primary affected case: bodyParams
    // strips the lip, so lastSolid ends up as the lipless body, while the
    // export should produce a bin WITH the lip.
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: SPLIT_WIDTH,
      depth: 2,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    };

    generateSplitPreview(params, CUT_PLANES_X, [], CONNECTORS_OFF);
    // After the fix: flag must be false so exportBin regenerates.
    expect(isLastSolidExportQuality()).toBe(false);

    const result = await exportBin(params, 'stl');

    expect(result.data.byteLength).toBeGreaterThan(0);
    expect(result.fileName).toMatch(/\.stl$/);

    // Validate that the exported STL actually contains the stacking lip
    // by parsing it and checking the Z extent. The lip adds ~4.4 mm above
    // the wall-top (wallTopZ = height × HEIGHT_UNIT).
    const parsed = parseSTLBinary(result.data);
    expect(isOk(parsed)).toBe(true);
    if (!isOk(parsed)) throw new Error('unreachable');

    const { maxZ } = getVertexBounds(parsed.value.vertices);
    const wallTopZ = params.height * GRIDFINITY.HEIGHT_UNIT;
    // The exported solid must extend above the wall top (lip present).
    expect(maxZ).toBeGreaterThan(wallTopZ + 1);
  }, 90000);

  it('exports successfully after split preview — magnet+screw base with lip', async () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: SPLIT_WIDTH,
      depth: 2,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet_and_screw', stackingLip: true },
    };

    generateSplitPreview(params, CUT_PLANES_X, [], CONNECTORS_OFF);
    expect(isLastSolidExportQuality()).toBe(false);

    const result = await exportBin(params, 'stl');

    expect(result.data.byteLength).toBeGreaterThan(0);
    expect(result.fileName).toMatch(/\.stl$/);
  }, 90000);

  it('STEP export also succeeds after split preview', async () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: SPLIT_WIDTH,
      depth: 2,
      height: 3,
    };

    generateSplitPreview(params, CUT_PLANES_X, [], CONNECTORS_OFF);
    expect(isLastSolidExportQuality()).toBe(false);

    const result = await exportBin(params, 'step');

    expect(result.data.byteLength).toBeGreaterThan(0);
    expect(result.fileName).toMatch(/\.step$/);
  }, 90000);

  it('export succeeds after split preview with connectors enabled', async () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: SPLIT_WIDTH,
      depth: 2,
      height: 3,
    };

    // With connectors the pieces include fuse+cut booleans, exercising
    // more complex tessellation state on the body solid.
    generateSplitPreview(params, CUT_PLANES_X, [], DEFAULT_SPLIT_CONNECTOR_CONFIG);
    expect(isLastSolidExportQuality()).toBe(false);

    const result = await exportBin(params, 'stl');

    expect(result.data.byteLength).toBeGreaterThan(0);
    expect(result.fileName).toMatch(/\.stl$/);
  }, 90000);

  it('export produces correct full-bin Z extent (not just the body without lip)', async () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: SPLIT_WIDTH,
      depth: 2,
      height: 4,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    };

    const cutPlanesX = [0]; // center split for width=6 on a 4-unit max bed

    generateSplitPreview(params, cutPlanesX, [], CONNECTORS_OFF);

    const result = await exportBin(params, 'stl');
    expect(result.data.byteLength).toBeGreaterThan(0);

    const parsed = parseSTLBinary(result.data);
    if (!isOk(parsed)) throw new Error('STL parse failed');

    const { minZ, maxZ, minX, maxX } = getVertexBounds(parsed.value.vertices);
    const exportedZ = maxZ - minZ;
    const expectedWallTopZ = params.height * GRIDFINITY.HEIGHT_UNIT;
    // The exported bin (full, not split) must have full height + lip.
    expect(exportedZ).toBeGreaterThan(expectedWallTopZ);

    // Width should span the full bin width (not just half — this catches
    // accidentally exporting a single split piece instead of the full bin).
    const outerW = params.width * GRID_UNIT;
    const exportedX = maxX - minX;
    expect(exportedX).toBeGreaterThan(outerW * 0.8);
  }, 90000);
});
