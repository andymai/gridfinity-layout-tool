// @vitest-environment node
/**
 * Verifies that the split planner / cutter handle non-rectangular bin
 * footprints. Splits are axis-aligned cut planes; for any closed polygon
 * (including L/T/U masks) the cut produces well-defined pieces because
 * each piece is the intersection of a half-space with the polygon-shaped
 * solid.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { BinParams } from '@/shared/types/bin';
import { resolveConstraints } from '@/shared/constraints';
import { binSplitChunkUnits } from '@/shared/utils/binSplitFit';
import { getSplitPlanePositionsMm } from '@/shared/utils/splitPositions';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { isOk } from '@/core/result';
import {
  initBrepjs,
  getGenerateSplitPreview,
  getExportSplitBin,
} from './__kernel-tests__/wasmInit';
import { boundingBox } from './__kernel-tests__/meshAssertions';
import { validateMask } from '@/shared/utils/cellMask';
import type { CellMask } from '@/shared/utils/cellMask';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

// 3×3 L: bottom-right 1u cell cleared.
const L_SHAPE_MASK: CellMask = {
  cols: 6,
  rows: 6,
  cells: [
    1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1,
  ] as (0 | 1)[],
};

describe('non-rectangular bin splitting', () => {
  it('splits a 3×3 L-shape into two pieces along the X axis', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 3,
      depth: 3,
      height: 3,
      cellMask: L_SHAPE_MASK,
    };
    const result = generateSplitPreview(params, [1], [], DEFAULT_SPLIT_CONNECTOR_CONFIG);

    expect(result.pieces).toHaveLength(2);
    for (const piece of result.pieces) {
      // Sanity: each piece has real geometry, no NaN/Infinity.
      expect(piece.vertices.length).toBeGreaterThan(100);
      expect(piece.indices.length).toBeGreaterThan(0);
      const bb = boundingBox(piece.vertices);
      // Both pieces must have positive volume (non-degenerate bbox).
      expect(bb.maxX - bb.minX).toBeGreaterThan(1);
      expect(bb.maxY - bb.minY).toBeGreaterThan(1);
      expect(bb.maxZ - bb.minZ).toBeGreaterThan(1);
    }
  });
});

/** Half-cell mask with every cell filled except where `empty(col, row)` says. */
function maskWithout(cols: number, rows: number, empty: (col: number, row: number) => boolean) {
  const cells: (0 | 1)[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) cells.push(empty(col, row) ? 0 : 1);
  }
  const mask: CellMask = { cols, rows, cells };
  expect(validateMask(mask)).toBeNull();
  return mask;
}

describe('custom shapes that leave a planned piece empty', () => {
  it('exports the pieces a shape reaches when the far piece holds none of it', async () => {
    let params: BinParams = { ...DEFAULT_BIN_PARAMS, width: 2, depth: 9, height: 6 };
    params = resolveConstraints(params, { feature: 'style.solid', enabled: true }).params;
    params = { ...params, base: { ...params.base, style: 'magnet' } };
    params = resolveConstraints(params, { feature: 'base.halfSockets', enabled: true }).params;
    params = { ...params, cellMask: maskWithout(4, 18, (_col, row) => row >= 9) };
    const chunk = binSplitChunkUnits(params, 256);
    const cutPlanesY = getSplitPlanePositionsMm(params.depth, chunk.depth, params.gridUnitMm);
    expect(cutPlanesY).toEqual([0]);

    const exported = await getExportSplitBin()(params, [], cutPlanesY, 0.01, undefined, {
      ...DEFAULT_SPLIT_CONNECTOR_CONFIG,
      nozzleSizeMm: 0.4,
    });

    expect(exported.pieces.map((p) => p.label)).toEqual(['A1']);
    const parsed = parseSTLBinary(exported.pieces[0].data);
    if (!isOk(parsed)) throw new Error('piece STL does not parse');
    const bb = boundingBox(parsed.value.vertices);
    expect(bb.maxZ - bb.minZ).toBeGreaterThan(params.height * params.heightUnitMm);
    expect(bb.maxY - bb.minY).toBeCloseTo(4.5 * params.gridUnitMm - 0.5, 0);
  }, 120_000);

  it('leaves out the notch of an L cut into quarters', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 10,
      depth: 10,
      height: 3,
      cellMask: maskWithout(20, 20, (col, row) => col >= 10 && row >= 10),
    };
    const result = getGenerateSplitPreview()(params, [0], [0], DEFAULT_SPLIT_CONNECTOR_CONFIG);
    expect(result.pieces.map((p) => p.label).sort()).toEqual(['A1', 'A2', 'B1']);
  }, 120_000);
});
