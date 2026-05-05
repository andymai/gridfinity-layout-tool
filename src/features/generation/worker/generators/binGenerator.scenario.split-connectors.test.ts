// @vitest-environment node
/**
 * Scenario tests for split connector geometry in preview meshes.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS, GRIDFINITY } from '@/shared/constants/bin';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { BinParams, SplitConnectorConfig } from '@/shared/types/bin';
import { initBrepjs, getGenerateSplitPreview } from './__kernel-tests__/wasmInit';
import { boundingBox, hasNoNaNOrInfinity } from './__kernel-tests__/meshAssertions';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

// ─── Constants ──────────────────────────────────────────────────────────────

const SIZE = GRIDFINITY.GRID_SIZE;
const CLEARANCE = GRIDFINITY.TOLERANCE;

/** Tessellation tolerance — geometry vertices may deviate from exact CAD by this amount. */
const TESS_TOL = 0.3;

/** 8×2×3 bin with default 1.2mm walls and stacking lip. */
const OVERSIZED_PARAMS: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  width: 8,
  depth: 2,
  height: 3,
};

const CUT_PLANES_X = [0];
const CUT_PLANES_Y: number[] = [];
const DISABLED_CONFIG: SplitConnectorConfig = { ...DEFAULT_SPLIT_CONNECTOR_CONFIG, enabled: false };

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Sum triangle counts across all pieces. */
function totalTriCount(pieces: { indices: { length: number } }[]): number {
  return pieces.reduce((sum, p) => sum + p.indices.length / 3, 0);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('split connector geometry in preview meshes', () => {
  it('generates 2 pieces with correct metadata for an 8-wide bin split at x=0', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const result = generateSplitPreview(OVERSIZED_PARAMS, CUT_PLANES_X, CUT_PLANES_Y);
    expect(result.pieces).toHaveLength(2);

    for (const piece of result.pieces) {
      expect(piece.widthUnits).toBeCloseTo(4, 1);
      expect(piece.depthUnits).toBeCloseTo(2, 1);
    }

    const sorted = [...result.pieces].sort((a, b) => a.col - b.col);
    expect(sorted[0].offsetX).toBeCloseTo(0, 1);
    expect(sorted[1].offsetX).toBeCloseTo(4, 1);
    expect(sorted[0].offsetY).toBeCloseTo(0, 1);
    expect(sorted[1].offsetY).toBeCloseTo(0, 1);
  }, 60000);

  it('no NaN or Infinity in any vertex or normal data', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const result = generateSplitPreview(
      OVERSIZED_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DEFAULT_SPLIT_CONNECTOR_CONFIG
    );

    for (const piece of result.pieces) {
      expect(hasNoNaNOrInfinity(piece.vertices)).toBe(true);
      expect(hasNoNaNOrInfinity(piece.normals)).toBe(true);
      expect(hasNoNaNOrInfinity(piece.edgeVertices)).toBe(true);
      expect(piece.indices.length).toBeGreaterThan(0);
    }
  }, 60000);

  it('piece bounding boxes match expected dimensions (±tessellation tolerance)', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const result = generateSplitPreview(
      OVERSIZED_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DISABLED_CONFIG
    );

    const outerW = OVERSIZED_PARAMS.width * SIZE - CLEARANCE;
    const outerD = OVERSIZED_PARAMS.depth * SIZE - CLEARANCE;
    const halfW = outerW / 2;
    const totalH = OVERSIZED_PARAMS.height * GRIDFINITY.HEIGHT_UNIT;
    const lipH = GRIDFINITY.LIP_HEIGHT;

    for (const piece of result.pieces) {
      const bb = boundingBox(piece.vertices);
      const pieceW = bb.maxX - bb.minX;
      const pieceD = bb.maxY - bb.minY;
      const pieceH = bb.maxZ - bb.minZ;

      expect(pieceW).toBeCloseTo(halfW, 0);
      expect(pieceD).toBeCloseTo(outerD, 0);
      expect(pieceH).toBeGreaterThan(totalH);
      expect(pieceH).toBeLessThan(totalH + lipH + 1);
    }
  }, 60000);

  it('male piece extends beyond nominal boundary with scarf lap', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const withConnectors = generateSplitPreview(
      OVERSIZED_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DEFAULT_SPLIT_CONNECTOR_CONFIG
    );
    const withoutConnectors = generateSplitPreview(
      OVERSIZED_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DISABLED_CONFIG
    );

    const maleWith = withConnectors.pieces.find((p) => p.col === 1);
    const maleWithout = withoutConnectors.pieces.find((p) => p.col === 1);

    if (!maleWith || !maleWithout) {
      expect.fail('Expected to find male pieces (col === 1) in both results');
    }

    const bbWith = boundingBox(maleWith.vertices);
    const bbWithout = boundingBox(maleWithout.vertices);

    // Scarf lap extends floorThickness past the cut face (at 45°, overlap = floor thickness)
    const extensionX = bbWith.maxX - bbWithout.maxX;
    expect(extensionX).toBeGreaterThan(0);
    expect(extensionX).toBeLessThan(OVERSIZED_PARAMS.wallThickness + TESS_TOL + 1.0);
  }, 60000);

  it('female piece has scarf ramp (more triangles than without connectors)', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const withConnectors = generateSplitPreview(
      OVERSIZED_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DEFAULT_SPLIT_CONNECTOR_CONFIG
    );
    const withoutConnectors = generateSplitPreview(
      OVERSIZED_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DISABLED_CONFIG
    );

    const femaleWith = withConnectors.pieces.find((p) => p.col === 2);
    const femaleWithout = withoutConnectors.pieces.find((p) => p.col === 2);

    if (!femaleWith || !femaleWithout) {
      expect.fail('Expected to find female pieces (col === 2) in both results');
    }

    const trisWith = femaleWith.indices.length / 3;
    const trisWithout = femaleWithout.indices.length / 3;
    expect(trisWith).toBeGreaterThan(trisWithout);
  }, 60000);

  it('undefined splitConnectorConfig skips connectors (same as disabled)', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const withUndefined = generateSplitPreview(
      OVERSIZED_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      undefined
    );
    const withDisabled = generateSplitPreview(
      OVERSIZED_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DISABLED_CONFIG
    );

    const trisUndef = totalTriCount(withUndefined.pieces);
    const trisDisabled = totalTriCount(withDisabled.pieces);
    expect(trisUndef).toBe(trisDisabled);
  }, 60000);

  it('falls back to params.splitConnectors when config arg is undefined', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const paramsWithConnectors: BinParams = {
      ...OVERSIZED_PARAMS,
      splitConnectors: DEFAULT_SPLIT_CONNECTOR_CONFIG,
    };
    const result = generateSplitPreview(paramsWithConnectors, CUT_PLANES_X, CUT_PLANES_Y);
    const withoutConnectors = generateSplitPreview(
      OVERSIZED_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DISABLED_CONFIG
    );

    const trisResult = totalTriCount(result.pieces);
    const trisWithout = totalTriCount(withoutConnectors.pieces);
    expect(trisResult - trisWithout).toBeGreaterThan(5);
  }, 60000);

  it('asymmetric multi-split produces correct piece count and labels', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const wideParams: BinParams = { ...DEFAULT_BIN_PARAMS, width: 13, depth: 2, height: 3 };
    const cuts = [-2 * SIZE, 2 * SIZE];
    const result = generateSplitPreview(wideParams, cuts, [], DEFAULT_SPLIT_CONNECTOR_CONFIG);

    expect(result.pieces).toHaveLength(3);

    for (const piece of result.pieces) {
      expect(hasNoNaNOrInfinity(piece.vertices)).toBe(true);
      expect(piece.vertices.length).toBeGreaterThan(0);
      expect(piece.indices.length).toBeGreaterThan(0);
    }

    const cols = result.pieces.map((p) => p.col).sort();
    expect(cols).toEqual([1, 2, 3]);
  }, 90000);

  // Regression: sketchOnPlane('XZ', pos) negated Y origin, causing Y-axis
  // prisms to land 40+ mm off instead of the expected ~3 mm protrusion.
  it('Y-axis split connector protrusion matches X-axis (no sign inversion)', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const maxAllowedGrowth = DEFAULT_SPLIT_CONNECTOR_CONFIG.tongueProtrusion + TESS_TOL + 1;

    const yParams: BinParams = { ...DEFAULT_BIN_PARAMS, width: 1, depth: 3, height: 3 };
    const xParams: BinParams = { ...DEFAULT_BIN_PARAMS, width: 3, depth: 1, height: 3 };

    const cases = [
      { params: yParams, cutsX: [] as number[], cutsY: [0], axis: 'Y' as const },
      { params: xParams, cutsX: [0], cutsY: [] as number[], axis: 'X' as const },
    ];

    for (const { params, cutsX, cutsY, axis } of cases) {
      const conn = generateSplitPreview(params, cutsX, cutsY, DEFAULT_SPLIT_CONNECTOR_CONFIG);
      const base = generateSplitPreview(params, cutsX, cutsY, DISABLED_CONFIG);

      // Male piece extends past cut face with scarf lap fuse.
      // Female piece only gets ramp cut — no bounding box growth.
      let totalGrowth = 0;
      for (let i = 0; i < conn.pieces.length; i++) {
        const connBB = boundingBox(conn.pieces[i].vertices);
        const baseBB = boundingBox(base.pieces[i].vertices);
        const growth =
          axis === 'Y'
            ? connBB.maxY - connBB.minY - (baseBB.maxY - baseBB.minY)
            : connBB.maxX - connBB.minX - (baseBB.maxX - baseBB.minX);

        expect(
          growth,
          `${axis}-split piece ${i} growth ${growth.toFixed(1)}mm exceeds max`
        ).toBeLessThan(maxAllowedGrowth);

        expect(
          growth,
          `${axis}-split piece ${i} growth ${growth.toFixed(1)}mm — piece shrank`
        ).toBeGreaterThanOrEqual(0);

        totalGrowth += growth;
      }

      // At least one piece must have positive growth (the male side)
      expect(
        totalGrowth,
        `${axis}-split total growth ${totalGrowth.toFixed(1)}mm — no connectors applied`
      ).toBeGreaterThan(0);
    }
  }, 120000);
});
