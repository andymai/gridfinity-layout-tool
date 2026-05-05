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
import { initBrepjs, getGenerateSplitPreview } from './__kernel-tests__/wasmInit';
import { boundingBox } from './__kernel-tests__/meshAssertions';
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
