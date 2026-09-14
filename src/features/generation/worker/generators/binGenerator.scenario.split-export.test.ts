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
import {
  initBrepjs,
  getGenerateSplitPreview,
  getExportSplitBin,
} from './__kernel-tests__/wasmInit';
import {
  boundingBox,
  hasNoNaNOrInfinity,
  meshTopologyStats,
  stlSolidVolume,
} from './__kernel-tests__/meshAssertions';
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

  it('exports a 5x2x3 bin with lip + x-axis cell-boundary cut without losing geometry', async () => {
    // Width 5 cells, cut at x=-21 — that's the cell-1/cell-2 boundary (cell
    // centers at -84, -42, 0, 42, 84; the boundary between cells 1 and 2
    // sits at -42 + gridUnit/2 = -21). Confirms the cell-boundary nudge
    // also fires on the x axis and doesn't regress lipped pieces.
    const exportSplitBin = getExportSplitBin();

    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 5,
      depth: 2,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    };

    const cutPlanesX: number[] = [-21];
    const connectors = { ...DEFAULT_SPLIT_CONNECTOR_CONFIG, enabled: false };
    const exported = await exportSplitBin(params, cutPlanesX, [], 0.01, 5, connectors);
    expect(exported.pieces).toHaveLength(2);
  }, 90000);

  it('exports a 3x10x7 standard-base no-lip bin without losing body Z (issue #1676)', async () => {
    // Reported failure: depth 10 forces a single y-cut at exactly y=0, which
    // lands on the shared wall between adjacent socket cells. Even with the
    // 0.01mm INTERIOR_MARGIN, OCCT was dropping ~22mm of wall geometry
    // (final piece Z=26.7mm vs expected 49mm), tripping the body-loss guard.
    const exportSplitBin = getExportSplitBin();

    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 3,
      depth: 10,
      height: 7,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    };

    // depth=10 with max=6 → one cut plane at center (y=0). That puts the
    // cut exactly on the shared socket-cell wall between cells 4 and 5.
    const cutPlanesY = [0];
    // Connectors enabled — matches the production default the bug reporter
    // would have hit; with connectors off the failure mode doesn't appear.
    const connectors = { ...DEFAULT_SPLIT_CONNECTOR_CONFIG };

    const exported = await exportSplitBin(params, [], cutPlanesY, 0.01, 5, connectors);
    const totalHeight = params.height * GRIDFINITY.HEIGHT_UNIT;

    expect(exported.pieces).toHaveLength(2);
    for (const piece of exported.pieces) {
      const { bb: exportBB } = exportPieceBounds(piece.data);
      const exportZ = exportBB.maxZ - exportBB.minZ;
      expect(
        exportZ,
        `piece ${piece.label}: Z=${exportZ.toFixed(1)}mm should reach full height ${totalHeight.toFixed(1)}mm`
      ).toBeGreaterThan(totalHeight * 0.9);
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

describe('split export: wall cutouts legitimately shorten a piece', () => {
  // A tall lipped bin with deep wall cutouts, split into a grid. Wall cutouts eat
  // down from the wall top, so an edge-column piece whose only surviving perimeter
  // wall carries a deep cutout comes out short — a valid solid, not an OCCT
  // coplanar wall-drop. The body-loss guard used to hard-fail the whole export with
  // "please report this bug" (auto-filed as issue #4243: "piece A2 lost geometry,
  // expected 64.0mm got 41.7mm"). The piece must export instead.
  const pos = { alignment: 'center' as const, offset: 0 };
  const deepCut = { enabled: true, width: 100, depth: 40, widthMm: null, ...pos };
  const off = { enabled: false, width: 0, depth: 0, widthMm: null, ...pos };

  const params: BinParams = {
    ...DEFAULT_BIN_PARAMS,
    width: 4,
    depth: 9,
    height: 9,
    base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    walls: {
      ...DEFAULT_BIN_PARAMS.walls,
      enabled: true,
      shape: 'u-shape',
      front: off,
      back: off,
      left: deepCut,
      right: deepCut,
    },
  };

  // 2 columns (x=0) × 3 rows (y=±63); A2 = column A (left edge), row 2 (middle).
  // Its only perimeter wall is the LEFT one; front/back/right are all split cuts.
  const cutPlanesX = [0];
  const cutPlanesY = [-63, 63];
  const connectors = { ...DEFAULT_SPLIT_CONNECTOR_CONFIG, enabled: false };

  it('exports piece A2 as a valid short solid instead of throwing', async () => {
    const exportSplitBin = getExportSplitBin();
    const exported = await exportSplitBin(params, cutPlanesX, cutPlanesY, 0.01, 5, connectors);
    expect(exported.pieces).toHaveLength(6);

    const a2 = exported.pieces.find((p) => p.label === 'A2');
    expect(a2, 'A2 piece should be present').toBeDefined();
    if (!a2) return;

    const parsed = parseSTLBinary(a2.data);
    expect(isOk(parsed), 'A2 STL parse should succeed').toBe(true);
    if (!isOk(parsed)) return;
    const { vertices } = parsed.value;
    expect(hasNoNaNOrInfinity(vertices), 'A2 vertices have NaN/Infinity').toBe(true);

    const bb = boundingBox(vertices);
    const z = bb.maxZ - bb.minZ;
    const body = params.height * GRIDFINITY.HEIGHT_UNIT;

    // The cutout removes the wall top, so A2 lands well below the old
    // `0.8 * body` guard that used to throw — but it keeps its lower wall,
    // so it is far taller than a bare floor.
    expect(
      z,
      `A2 Z=${z.toFixed(1)}mm should be short (below the old ${(body * 0.8).toFixed(1)}mm guard)`
    ).toBeLessThan(body * 0.8);
    expect(
      z,
      `A2 Z=${z.toFixed(1)}mm should keep its lower wall, not just a floor`
    ).toBeGreaterThan(SOCKET_HEIGHT + 10);

    // The short piece is a proper printable solid: watertight, 2-manifold,
    // genus-0, positive volume — proof the boolean produced valid geometry.
    const idx = new Uint32Array(vertices.length / 3);
    for (let i = 0; i < idx.length; i++) idx[i] = i;
    const topo = meshTopologyStats({
      vertices,
      normals: new Float32Array(vertices.length),
      indices: idx,
      edgeVertices: new Float32Array(0),
      triangleCount: idx.length / 3,
    });
    expect(topo.boundaryEdges, 'A2 must be watertight').toBe(0);
    expect(topo.nonManifoldEdges, 'A2 must be 2-manifold').toBe(0);
    expect(topo.eulerCharacteristic, 'A2 must be a single genus-0 shell').toBe(2);
    expect(stlSolidVolume(vertices), 'A2 must enclose positive volume').toBeGreaterThan(0);
  }, 90000);

  it('still reaches full height where the cutout is shallow', async () => {
    const exportSplitBin = getExportSplitBin();
    const shallow: BinParams = {
      ...params,
      walls: {
        ...params.walls,
        left: { enabled: true, width: 100, depth: 10, widthMm: null, ...pos },
        right: { enabled: true, width: 100, depth: 10, widthMm: null, ...pos },
      },
    };
    const exported = await exportSplitBin(shallow, cutPlanesX, cutPlanesY, 0.01, 5, connectors);
    const body = shallow.height * GRIDFINITY.HEIGHT_UNIT;
    for (const piece of exported.pieces) {
      const { bb } = exportPieceBounds(piece.data);
      const z = bb.maxZ - bb.minZ;
      expect(
        z,
        `piece ${piece.label}: Z=${z.toFixed(1)}mm should stay near full height with a shallow cutout`
      ).toBeGreaterThan(body * 0.8);
    }
  }, 90000);
});
