/**
 * Scenario test: custom gridUnitMm produces correctly scaled geometry.
 *
 * Verifies that bins generated with non-standard grid units (e.g. 50mm)
 * have bounding boxes matching the custom unit, not the hardcoded 42mm.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin, getGenerateSplitPreview } from './__kernel-tests__/wasmInit';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { GRIDFINITY } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';

const CLEARANCE = GRIDFINITY.TOLERANCE;

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

describe('custom gridUnitMm', () => {
  it('should generate geometry scaled to custom gridUnitMm', () => {
    const generateBin = getGenerateBin();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 1,
      depth: 1,
      height: 3,
      gridUnitMm: 50,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: false },
    };

    const mesh = generateBin(params);
    expect(mesh.vertices).not.toBeNull();

    // Verify bounding box width matches gridUnitMm, not 42mm
    const verts = mesh.vertices;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < verts.length; i += 3) {
      minX = Math.min(minX, verts[i]);
      maxX = Math.max(maxX, verts[i]);
      minY = Math.min(minY, verts[i + 1]);
      maxY = Math.max(maxY, verts[i + 1]);
    }
    const width = maxX - minX;
    const depth = maxY - minY;
    const expected = 1 * 50 - CLEARANCE; // 49.5mm
    expect(width).toBeCloseTo(expected, 0);
    expect(depth).toBeCloseTo(expected, 0);
  }, 30_000);

  it('split preview pieces should use custom gridUnitMm', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 8,
      depth: 1,
      height: 3,
      gridUnitMm: 50,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: false },
    };

    const cutX = [0]; // split in half at center
    const result = generateSplitPreview(params, cutX, []);

    expect(result.pieces).toHaveLength(2);
    // Each piece should be ~half the width in grid units
    for (const piece of result.pieces) {
      expect(piece.widthUnits).toBeCloseTo(4, 0);
    }
  }, 30_000);
});
