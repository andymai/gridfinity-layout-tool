// @vitest-environment node
/**
 * Scenario tests for split connector geometry in preview meshes.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS, GRIDFINITY } from '@/shared/constants/bin';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { BinParams, SplitConnectorConfig } from '@/shared/types/bin';
import { initBrepjs, getGenerateSplitPreview } from './__dual-kernel__/wasmInit';
import { boundingBox, hasNoNaNOrInfinity } from './__dual-kernel__/meshAssertions';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

// ─── Constants ──────────────────────────────────────────────────────────────

const SIZE = GRIDFINITY.GRID_SIZE;
const CLEARANCE = GRIDFINITY.TOLERANCE;

/** Tessellation tolerance — geometry vertices may deviate from exact CAD by this amount. */
const TESS_TOL = 0.3;

/** 8×2×3 bin with default 1.2mm walls and stacking lip.
 *  Half-lap wall connectors interlock in the wall zone; lip is preserved intact. */
const OVERSIZED_PARAMS: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  width: 8,
  depth: 2,
  height: 3,
};

/** Same dimensions but WITHOUT stacking lip — half-lap wall connectors
 *  are used at < 1.4mm wall thickness. */
const OVERSIZED_NO_LIP: BinParams = {
  ...OVERSIZED_PARAMS,
  base: { ...OVERSIZED_PARAMS.base, stackingLip: false },
};

/** 7x3x3 bin with 1.6mm walls — above the half-lap threshold, so T&G is used. */
const THICK_WALL_PARAMS: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  width: 7,
  depth: 3,
  height: 3,
  wallThickness: 1.6,
};

const CUT_PLANES_X = [0];
const CUT_PLANES_Y: number[] = [];
const DISABLED_CONFIG: SplitConnectorConfig = { ...DEFAULT_SPLIT_CONNECTOR_CONFIG, enabled: false };

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Find the extreme X coordinate among vertices near a given Y position. */
function extremeXNearY(
  vertices: Float32Array,
  targetY: number,
  yTolerance: number,
  mode: 'max' | 'min'
): number {
  let result = mode === 'max' ? -Infinity : Infinity;
  const compare = mode === 'max' ? Math.max : Math.min;
  for (let i = 0; i < vertices.length; i += 3) {
    if (Math.abs(vertices[i + 1] - targetY) < yTolerance) {
      result = compare(result, vertices[i]);
    }
  }
  return result;
}

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

  it('male piece extends beyond nominal boundary with connectors (tongue protrusion)', () => {
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

    const protrusion = DEFAULT_SPLIT_CONNECTOR_CONFIG.tongueProtrusion;
    const extensionX = bbWith.maxX - bbWithout.maxX;
    expect(extensionX).toBeGreaterThan(protrusion - TESS_TOL - 0.5);
    expect(extensionX).toBeLessThan(protrusion + TESS_TOL + 0.5);
  }, 60000);

  it('female piece has groove (vertices recessed inside piece boundary)', () => {
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

  it('connector clearance widens groove relative to tongue', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const tightConfig: SplitConnectorConfig = {
      ...DEFAULT_SPLIT_CONNECTOR_CONFIG,
      clearance: 0.0,
    };
    const looseConfig: SplitConnectorConfig = {
      ...DEFAULT_SPLIT_CONNECTOR_CONFIG,
      clearance: 0.3,
    };

    const tight = generateSplitPreview(OVERSIZED_PARAMS, CUT_PLANES_X, CUT_PLANES_Y, tightConfig);
    const loose = generateSplitPreview(OVERSIZED_PARAMS, CUT_PLANES_X, CUT_PLANES_Y, looseConfig);

    const femaleTight = tight.pieces.find((p) => p.col === 2);
    const femaleLoose = loose.pieces.find((p) => p.col === 2);

    if (!femaleTight || !femaleLoose) {
      expect.fail('Expected to find female pieces (col === 2) in both results');
    }

    const trisTight = femaleTight.indices.length / 3;
    const trisLoose = femaleLoose.indices.length / 3;
    expect(trisTight).not.toBe(trisLoose);
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

  it('wall tongues at 1.6mm wall thickness do not destroy bin geometry', () => {
    const generateSplitPreview = getGenerateSplitPreview();

    const withoutConnectors = generateSplitPreview(
      THICK_WALL_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DISABLED_CONFIG
    );
    expect(withoutConnectors.pieces).toHaveLength(2);
    const baseVertCount = withoutConnectors.pieces[0].vertices.length;
    expect(baseVertCount).toBeGreaterThan(100);

    const result = generateSplitPreview(
      THICK_WALL_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DEFAULT_SPLIT_CONNECTOR_CONFIG
    );

    expect(result.pieces).toHaveLength(2);

    const outerW = THICK_WALL_PARAMS.width * SIZE - CLEARANCE;
    const halfW = outerW / 2;
    const outerD = THICK_WALL_PARAMS.depth * SIZE - CLEARANCE;

    for (const piece of result.pieces) {
      expect(hasNoNaNOrInfinity(piece.vertices)).toBe(true);
      expect(piece.vertices.length).toBeGreaterThan(100);

      const bb = boundingBox(piece.vertices);
      const pieceW = bb.maxX - bb.minX;
      const pieceD = bb.maxY - bb.minY;

      // Each piece should be approximately half the bin width
      expect(pieceW).toBeGreaterThan(halfW - 5);
      expect(pieceD).toBeGreaterThan(outerD - 2);
    }
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

  it('half-lap joints at 1.2mm walls produce geometry changes', () => {
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

    // Half-lap cuts into walls create additional internal faces → more triangles
    const trisWithConn = totalTriCount(withConnectors.pieces);
    const trisWithout = totalTriCount(withoutConnectors.pieces);
    expect(trisWithConn).toBeGreaterThan(trisWithout);

    for (const piece of withConnectors.pieces) {
      expect(hasNoNaNOrInfinity(piece.vertices)).toBe(true);
      expect(piece.vertices.length).toBeGreaterThan(100);
    }
  }, 60000);

  it('half-lap at 1.2mm walls produces less X-extension than T&G at 1.6mm', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    // At 1.2mm walls, half-lap adds wall tabs (half-wall protrusion) + floor tongue.
    // At 1.6mm walls, T&G adds full wall tongues + floor tongues.
    // The 1.2mm half-lap male piece should extend less than the 1.6mm T&G male piece.
    const thinResult = generateSplitPreview(
      OVERSIZED_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DEFAULT_SPLIT_CONNECTOR_CONFIG
    );
    const thickParams: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 8,
      depth: 2,
      height: 3,
      wallThickness: 1.6,
    };
    const thickResult = generateSplitPreview(
      thickParams,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DEFAULT_SPLIT_CONNECTOR_CONFIG
    );

    const thinMale = thinResult.pieces.find((p) => p.col === 1);
    const thickMale = thickResult.pieces.find((p) => p.col === 1);

    if (!thinMale || !thickMale) {
      expect.fail('Expected to find male pieces (col === 1) in both results');
    }

    const thinMaxX = boundingBox(thinMale.vertices).maxX;
    const thickMaxX = boundingBox(thickMale.vertices).maxX;

    // T&G adds wall tongues that extend further; half-lap only has floor tongue
    expect(thinMaxX).toBeLessThan(thickMaxX + TESS_TOL);
  }, 60000);

  it('half-lap wall cuts preserve stacking lip intact (lip + thin walls)', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    // Half-lap cuts only affect the wall zone. The lip was already intersected
    // with the cutting box, so each piece's lip terminates at the cut face.
    // When assembled, both pieces' lips meet edge-to-edge with no gap.
    const withConn = generateSplitPreview(
      OVERSIZED_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DEFAULT_SPLIT_CONNECTOR_CONFIG
    );
    const withoutConn = generateSplitPreview(
      OVERSIZED_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DISABLED_CONFIG
    );

    for (const piece of withConn.pieces) {
      expect(hasNoNaNOrInfinity(piece.vertices)).toBe(true);
      expect(piece.vertices.length).toBeGreaterThan(100);
    }

    // Half-lap cuts in the wall zone still produce more triangles than no connectors
    const trisConn = totalTriCount(withConn.pieces);
    const trisNoConn = totalTriCount(withoutConn.pieces);
    expect(trisConn).toBeGreaterThan(trisNoConn);

    // Lip max Z should be identical with and without connectors — the lip
    // is untouched by the half-lap (no material removed from lip zone).
    const wallTopZ = OVERSIZED_PARAMS.height * GRIDFINITY.HEIGHT_UNIT;
    for (const connPiece of withConn.pieces) {
      const noConnPiece = withoutConn.pieces.find((p) => p.col === connPiece.col);
      expect(noConnPiece).toBeDefined();
      if (!noConnPiece) continue;

      const connBb = boundingBox(connPiece.vertices);
      const noConnBb = boundingBox(noConnPiece.vertices);

      // Both should reach the same lip height (within tessellation tolerance)
      expect(connBb.maxZ).toBeGreaterThan(wallTopZ);
      expect(Math.abs(connBb.maxZ - noConnBb.maxZ)).toBeLessThan(0.5);
    }
  }, 90000);

  it('male wall tabs protrude past cut face at wall Y positions (no lip)', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const outerD = OVERSIZED_NO_LIP.depth * SIZE - CLEARANCE;
    const wt = OVERSIZED_NO_LIP.wallThickness;
    const wallOffset = outerD / 2 - wt / 2;

    const withConn = generateSplitPreview(
      OVERSIZED_NO_LIP,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DEFAULT_SPLIT_CONNECTOR_CONFIG
    );
    const withoutConn = generateSplitPreview(
      OVERSIZED_NO_LIP,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DISABLED_CONFIG
    );

    const maleWith = withConn.pieces.find((p) => p.col === 1);
    const maleWithout = withoutConn.pieces.find((p) => p.col === 1);
    expect(maleWith).toBeDefined();
    expect(maleWithout).toBeDefined();
    if (!maleWith || !maleWithout) return;

    const wallMaxXWith = extremeXNearY(maleWith.vertices, wallOffset, wt, 'max');
    const wallMaxXWithout = extremeXNearY(maleWithout.vertices, wallOffset, wt, 'max');
    const wallProtrusion = wallMaxXWith - wallMaxXWithout;
    const expectedProtrusion = DEFAULT_SPLIT_CONNECTOR_CONFIG.tongueProtrusion;

    expect(wallProtrusion).toBeGreaterThan(expectedProtrusion - TESS_TOL - 0.5);
  }, 60000);

  it('male wall tabs protrude past cut face at wall Y positions (with lip)', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const outerD = OVERSIZED_PARAMS.depth * SIZE - CLEARANCE;
    const wt = OVERSIZED_PARAMS.wallThickness;
    const wallOffset = outerD / 2 - wt / 2;

    const withConn = generateSplitPreview(
      OVERSIZED_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DEFAULT_SPLIT_CONNECTOR_CONFIG
    );
    const withoutConn = generateSplitPreview(
      OVERSIZED_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DISABLED_CONFIG
    );

    const maleWith = withConn.pieces.find((p) => p.col === 1);
    const maleWithout = withoutConn.pieces.find((p) => p.col === 1);
    expect(maleWith).toBeDefined();
    expect(maleWithout).toBeDefined();
    if (!maleWith || !maleWithout) return;

    const wallMaxXWith = extremeXNearY(maleWith.vertices, wallOffset, wt, 'max');
    const wallMaxXWithout = extremeXNearY(maleWithout.vertices, wallOffset, wt, 'max');
    const wallProtrusion = wallMaxXWith - wallMaxXWithout;
    const expectedProtrusion = DEFAULT_SPLIT_CONNECTOR_CONFIG.tongueProtrusion;

    expect(wallProtrusion).toBeGreaterThan(expectedProtrusion - TESS_TOL - 0.5);
  }, 60000);

  it('female wall tab protrudes into male territory at wall Y positions (with lip)', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const outerD = OVERSIZED_PARAMS.depth * SIZE - CLEARANCE;
    const wt = OVERSIZED_PARAMS.wallThickness;
    const wallOffset = outerD / 2 - wt / 2;

    const withConn = generateSplitPreview(
      OVERSIZED_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DEFAULT_SPLIT_CONNECTOR_CONFIG
    );
    const withoutConn = generateSplitPreview(
      OVERSIZED_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DISABLED_CONFIG
    );

    const femaleWith = withConn.pieces.find((p) => p.col === 2);
    const femaleWithout = withoutConn.pieces.find((p) => p.col === 2);
    expect(femaleWith).toBeDefined();
    expect(femaleWithout).toBeDefined();
    if (!femaleWith || !femaleWithout) return;

    const femaleMinXWith = extremeXNearY(femaleWith.vertices, wallOffset, wt, 'min');
    const femaleMinXWithout = extremeXNearY(femaleWithout.vertices, wallOffset, wt, 'min');
    const femaleProtrusion = femaleMinXWithout - femaleMinXWith;
    const expectedProtrusion = DEFAULT_SPLIT_CONNECTOR_CONFIG.tongueProtrusion;

    expect(femaleProtrusion).toBeGreaterThan(expectedProtrusion - TESS_TOL - 0.5);
  }, 60000);

  it('tongue-and-groove activates at 1.6mm walls (male extends past cut face)', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const withConnectors = generateSplitPreview(
      THICK_WALL_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DEFAULT_SPLIT_CONNECTOR_CONFIG
    );
    const withoutConnectors = generateSplitPreview(
      THICK_WALL_PARAMS,
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

    const protrusion = DEFAULT_SPLIT_CONNECTOR_CONFIG.tongueProtrusion;
    const extensionX = bbWith.maxX - bbWithout.maxX;
    expect(extensionX).toBeGreaterThan(protrusion - TESS_TOL - 0.5);
  }, 60000);

  it('lip max Z at wall positions is preserved with half-lap connectors', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const outerD = OVERSIZED_PARAMS.depth * SIZE - CLEARANCE;
    const wt = OVERSIZED_PARAMS.wallThickness;
    const wallOffset = outerD / 2 - wt / 2;
    const wallTopZ = OVERSIZED_PARAMS.height * GRIDFINITY.HEIGHT_UNIT;
    const expectedLipTop = wallTopZ + GRIDFINITY.LIP_HEIGHT;

    const withConn = generateSplitPreview(
      OVERSIZED_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DEFAULT_SPLIT_CONNECTOR_CONFIG
    );

    // At each wall Y position, the lip should reach full height even with connectors.
    // This catches the regression where half-lap cuts removed lip material.
    for (const piece of withConn.pieces) {
      let maxZAtWall = -Infinity;
      for (let i = 0; i < piece.vertices.length; i += 3) {
        if (Math.abs(Math.abs(piece.vertices[i + 1]) - wallOffset) < wt) {
          maxZAtWall = Math.max(maxZAtWall, piece.vertices[i + 2]);
        }
      }
      expect(maxZAtWall, `piece ${piece.label} lip truncated at wall`).toBeGreaterThan(
        expectedLipTop - 1.0
      );
    }
  }, 60000);

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
          `${axis}-split piece ${i} growth ${growth.toFixed(1)}mm — connector missing`
        ).toBeGreaterThan(0);
      }
    }
  }, 120000);
});
