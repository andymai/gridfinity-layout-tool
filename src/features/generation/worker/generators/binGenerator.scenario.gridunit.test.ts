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

  it('should generate non-square geometry when gridUnitMmY differs from gridUnitMm', () => {
    const generateBin = getGenerateBin();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 3,
      height: 3,
      gridUnitMm: 42, // X pitch
      gridUnitMmY: 22, // Y pitch (non-square)
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: false },
    };

    const mesh = generateBin(params);
    expect(mesh.vertices).not.toBeNull();

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
    // X uses gridUnitMm (42), Y uses gridUnitMmY (22). The two axes must differ.
    expect(width).toBeCloseTo(2 * 42 - CLEARANCE, 0); // 83.5mm
    expect(depth).toBeCloseTo(3 * 22 - CLEARANCE, 0); // 65.5mm
  }, 30_000);

  it('places a magnet that fits a narrow non-square foot (no side breach)', () => {
    const generateBin = getGenerateBin();
    // 1×1 bin at 25×42 pitch. The 25mm-wide foot (half 12.5mm) can't hold the
    // ±13mm corner magnets, so the fit-or-center rule drops in a centered magnet
    // instead of magnets breaching the foot's side.
    const common = {
      ...DEFAULT_BIN_PARAMS,
      width: 1,
      depth: 1,
      height: 3,
      gridUnitMm: 25,
      gridUnitMmY: 42,
    } as const;
    const withMag = generateBin({
      ...common,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', stackingLip: false },
    });
    const noMag = generateBin({
      ...common,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'standard', stackingLip: false },
    });

    expect(withMag.vertices).not.toBeNull();
    // A magnet hole was cut into the foot (more geometry than the plain socket).
    expect(withMag.vertices.length).toBeGreaterThan(noMag.vertices.length);

    // Footprint still matches the pitch — the magnet is an internal cut, not a
    // spur poking out the 25mm side (which the old ±13mm placement produced).
    const verts = withMag.vertices;
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
    expect(maxX - minX).toBeCloseTo(1 * 25 - CLEARANCE, 0); // 24.5mm
    expect(maxY - minY).toBeCloseTo(1 * 42 - CLEARANCE, 0); // 41.5mm
  }, 30_000);

  it('should place anisotropic feet at the correct per-axis pitch (socketed bin)', () => {
    const generateBin = getGenerateBin();
    // A socketed 2×2 bin: feet centers sit at ±gridUnit/2 per axis. With a
    // non-square grid the foot grid is wider in X than Y.
    const square = generateBin({
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 2,
      height: 3,
      gridUnitMm: 42,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'standard', stackingLip: false },
    });
    const aniso = generateBin({
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 2,
      height: 3,
      gridUnitMm: 42,
      gridUnitMmY: 22,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'standard', stackingLip: false },
    });

    const extent = (mesh: typeof square, axis: 0 | 1): number => {
      const v = mesh.vertices;
      let min = Infinity;
      let max = -Infinity;
      for (let i = 0; i < v.length; i += 3) {
        min = Math.min(min, v[i + axis]);
        max = Math.max(max, v[i + axis]);
      }
      return max - min;
    };

    // X extent identical; Y extent shrinks to the 22mm pitch.
    expect(extent(aniso, 0)).toBeCloseTo(extent(square, 0), 0);
    expect(extent(aniso, 1)).toBeCloseTo(2 * 22 - CLEARANCE, 0); // 41.5mm
    expect(extent(aniso, 1)).toBeLessThan(extent(square, 1) - 10);
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

  it('split preview reports grid units per-axis for a non-square grid', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    // 2 wide × 8 deep at 42×22. Split along Y (depth) at center → two 2×4 pieces.
    // widthUnits must use the X pitch (42), depthUnits the Y pitch (22).
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 8,
      height: 3,
      gridUnitMm: 42,
      gridUnitMmY: 22,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: false },
    };

    const result = generateSplitPreview(params, [], [0]);

    expect(result.pieces).toHaveLength(2);
    for (const piece of result.pieces) {
      expect(piece.widthUnits).toBeCloseTo(2, 0); // X via 42mm pitch
      expect(piece.depthUnits).toBeCloseTo(4, 0); // Y via 22mm pitch
    }
  }, 30_000);
});
