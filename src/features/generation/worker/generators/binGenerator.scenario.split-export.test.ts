// @vitest-environment node
/**
 * Tests that split bin export (STL output) produces complete geometry
 * matching the preview mesh.
 *
 * Regression test for a bug where brepjs exportSTL skipped re-meshing
 * because hasTriangulation() found stale triangulation on faces reused
 * from the pre-split body solid, leaving new cut-plane faces un-tessellated.
 * Result: exported STL contained only sockets (reused faces with existing
 * triangulation), missing walls and floor.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS, GRIDFINITY } from '@/shared/constants/bin';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { BinParams } from '@/shared/types/bin';
import { initBrepjs, getGenerateSplitPreview, getExportSplitBin } from './__dual-kernel__/wasmInit';
import { boundingBox, hasNoNaNOrInfinity } from './__dual-kernel__/meshAssertions';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { isOk } from '@/core/result';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

const SOCKET_HEIGHT = GRIDFINITY.SOCKET_HEIGHT;

/**
 * Parse an exported STL piece and compute its bounding box.
 * Throws if the STL buffer is malformed.
 */
function exportPieceBounds(data: ArrayBuffer) {
  const result = parseSTLBinary(data);
  expect(isOk(result), 'STL parse should succeed').toBe(true);
  if (!isOk(result)) throw new Error('unreachable');
  const { vertices } = result.value;
  expect(hasNoNaNOrInfinity(vertices), 'export vertices have NaN/Infinity').toBe(true);
  return { bb: boundingBox(vertices), triangleCount: vertices.length / 9 };
}

describe('split export: geometry completeness', () => {
  it('exported STL pieces have same Z extent as preview pieces', async () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const exportSplitBin = getExportSplitBin();

    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 6,
      depth: 2,
      height: 3,
    };

    const cutPlanesX = [0];
    const connectors = { ...DEFAULT_SPLIT_CONNECTOR_CONFIG, enabled: false };

    // Generate preview (known-good: uses mesh() which always tessellates)
    const preview = generateSplitPreview(params, cutPlanesX, [], connectors);
    expect(preview.pieces).toHaveLength(2);

    // Generate export (was broken: uses exportSTL which skipped tessellation)
    const exported = await exportSplitBin(params, cutPlanesX, [], 0.01, 5, connectors);
    expect(exported.pieces).toHaveLength(2);

    const totalHeight = params.height * GRIDFINITY.HEIGHT_UNIT;

    for (let i = 0; i < preview.pieces.length; i++) {
      const previewBB = boundingBox(preview.pieces[i].vertices);
      const { bb: exportBB, triangleCount } = exportPieceBounds(exported.pieces[i].data);

      const previewZ = previewBB.maxZ - previewBB.minZ;
      const exportZ = exportBB.maxZ - exportBB.minZ;

      // Export must not be shorter than preview (regression: missing geometry)
      expect(
        exportZ,
        `piece ${i}: export Z=${exportZ.toFixed(1)}mm vs preview Z=${previewZ.toFixed(1)}mm — ` +
          `missing geometry if export Z is much shorter (socket-only ≈${SOCKET_HEIGHT}mm)`
      ).toBeGreaterThan(previewZ - 1);

      // Both should reach full bin height
      expect(exportZ, `piece ${i}: export should reach full height`).toBeGreaterThan(
        totalHeight * 0.9
      );

      // Export should have substantial triangle count (not just sockets)
      expect(
        triangleCount,
        `piece ${i}: export has too few triangles (${triangleCount}), likely missing geometry`
      ).toBeGreaterThan(50);
    }
  }, 90000);

  it('exported STL pieces with lip have correct Z extent', async () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const exportSplitBin = getExportSplitBin();

    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 6,
      depth: 2,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    };

    const cutPlanesX = [0];
    const connectors = { ...DEFAULT_SPLIT_CONNECTOR_CONFIG, enabled: false };

    const preview = generateSplitPreview(params, cutPlanesX, [], connectors);
    const exported = await exportSplitBin(params, cutPlanesX, [], 0.01, 5, connectors);

    const totalHeight = params.height * GRIDFINITY.HEIGHT_UNIT;

    for (let i = 0; i < preview.pieces.length; i++) {
      const previewBB = boundingBox(preview.pieces[i].vertices);
      const { bb: exportBB } = exportPieceBounds(exported.pieces[i].data);

      const previewZ = previewBB.maxZ - previewBB.minZ;
      const exportZ = exportBB.maxZ - exportBB.minZ;

      // With lip, Z should extend above wall top
      expect(exportZ, `piece ${i}: export with lip should exceed wall height`).toBeGreaterThan(
        totalHeight
      );

      // Export must not be shorter than preview (regression: missing geometry)
      expect(
        exportZ,
        `piece ${i}: export Z=${exportZ.toFixed(1)}mm vs preview Z=${previewZ.toFixed(1)}mm`
      ).toBeGreaterThan(previewZ - 1);
    }
  }, 90000);

  it('exported STL pieces with magnet+screw base have full geometry', async () => {
    const exportSplitBin = getExportSplitBin();

    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 6,
      depth: 2,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet_and_screw' },
    };

    const cutPlanesX = [0];
    const connectors = { ...DEFAULT_SPLIT_CONNECTOR_CONFIG, enabled: false };

    const exported = await exportSplitBin(params, cutPlanesX, [], 0.01, 5, connectors);
    const totalHeight = params.height * GRIDFINITY.HEIGHT_UNIT;

    for (const piece of exported.pieces) {
      const { bb: exportBB, triangleCount } = exportPieceBounds(piece.data);
      const exportZ = exportBB.maxZ - exportBB.minZ;

      expect(
        exportZ,
        `piece ${piece.label}: Z=${exportZ.toFixed(1)}mm should reach full height ${totalHeight.toFixed(1)}mm`
      ).toBeGreaterThan(totalHeight * 0.9);
      expect(
        triangleCount,
        `piece ${piece.label}: should have substantial geometry`
      ).toBeGreaterThan(100);
    }
  }, 90000);
});
