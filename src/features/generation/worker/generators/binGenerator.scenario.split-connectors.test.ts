// @vitest-environment node
/**
 * Scenario tests for split connector geometry in preview meshes.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import { GRIDFINITY } from '@/shared/constants/bin';
import type { BinParams, SplitConnectorConfig } from '@/shared/types/bin';

interface SplitPreviewResult {
  readonly pieces: Array<{
    readonly vertices: Float32Array;
    readonly normals: Float32Array;
    readonly indices: Uint32Array;
    readonly edgeVertices: Float32Array;
    readonly label: string;
    readonly col: number;
    readonly row: number;
    readonly widthUnits: number;
    readonly depthUnits: number;
    readonly offsetX: number;
    readonly offsetY: number;
  }>;
}

type GenerateSplitPreviewFn = (
  params: BinParams,
  cutPlanesX: readonly number[],
  cutPlanesY: readonly number[],
  splitConnectorConfig?: SplitConnectorConfig
) => SplitPreviewResult;

let generateSplitPreview: GenerateSplitPreviewFn;

beforeAll(async () => {
  const { initFromOC } = await import('brepjs');
  const opencascade = (await import('brepjs-opencascade/src/brepjs_single.js')).default;
  const { readFileSync } = await import('fs');
  const { join } = await import('path');

  const wasmPath = join(process.cwd(), 'node_modules/brepjs-opencascade/src/brepjs_single.wasm');
  const wasmBinary = readFileSync(wasmPath);
  const OC = await opencascade({ wasmBinary });
  initFromOC(OC);

  const mod = await import('@/features/generation/worker/generators/binGenerator');
  generateSplitPreview = mod.generateSplitPreview as GenerateSplitPreviewFn;
}, 30000);

// ─── Constants ──────────────────────────────────────────────────────────────

const SIZE = GRIDFINITY.GRID_SIZE;
const CLEARANCE = GRIDFINITY.TOLERANCE;

/** Tessellation tolerance — geometry vertices may deviate from exact CAD by this amount. */
const TESS_TOL = 0.3;

/** 8×2×3 bin with default 1.2mm walls. At this wall thickness, only
 *  floor tongue and lip step are generated (wall tongues need ≥1.4mm). */
const OVERSIZED_PARAMS: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  width: 8,
  depth: 2,
  height: 3,
};

const CUT_PLANES_X = [0];
const CUT_PLANES_Y: number[] = [];
const DISABLED_CONFIG: SplitConnectorConfig = { ...DEFAULT_SPLIT_CONNECTOR_CONFIG, enabled: false };

// ─── Helpers ────────────────────────────────────────────────────────────────

interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

function boundingBox(vertices: Float32Array): BoundingBox {
  const bb: BoundingBox = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
  };
  for (let i = 0; i < vertices.length; i += 3) {
    bb.minX = Math.min(bb.minX, vertices[i]);
    bb.maxX = Math.max(bb.maxX, vertices[i]);
    bb.minY = Math.min(bb.minY, vertices[i + 1]);
    bb.maxY = Math.max(bb.maxY, vertices[i + 1]);
    bb.minZ = Math.min(bb.minZ, vertices[i + 2]);
    bb.maxZ = Math.max(bb.maxZ, vertices[i + 2]);
  }
  return bb;
}

function hasNoNaNOrInfinity(vertices: Float32Array): boolean {
  for (let i = 0; i < vertices.length; i++) {
    if (!Number.isFinite(vertices[i])) return false;
  }
  return true;
}

describe('split connector geometry in preview meshes', () => {
  it('generates 2 pieces with correct metadata for an 8-wide bin split at x=0', () => {
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
    expect(maleWith).toBeDefined();
    expect(maleWithout).toBeDefined();

    const bbWith = boundingBox(maleWith!.vertices);
    const bbWithout = boundingBox(maleWithout!.vertices);

    const protrusion = DEFAULT_SPLIT_CONNECTOR_CONFIG.tongueProtrusion;
    const extensionX = bbWith.maxX - bbWithout.maxX;
    expect(extensionX).toBeGreaterThan(protrusion - TESS_TOL - 0.5);
    expect(extensionX).toBeLessThan(protrusion + TESS_TOL + 0.5);
  }, 60000);

  it('female piece has groove (vertices recessed inside piece boundary)', () => {
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
    expect(femaleWith).toBeDefined();
    expect(femaleWithout).toBeDefined();

    const trisWith = femaleWith!.indices.length / 3;
    const trisWithout = femaleWithout!.indices.length / 3;
    expect(trisWith).toBeGreaterThan(trisWithout);
  }, 60000);

  it('connector clearance widens groove relative to tongue', () => {
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
    expect(femaleTight).toBeDefined();
    expect(femaleLoose).toBeDefined();

    const trisTight = femaleTight!.indices.length / 3;
    const trisLoose = femaleLoose!.indices.length / 3;
    expect(trisTight).not.toBe(trisLoose);
  }, 60000);

  it('undefined splitConnectorConfig skips connectors (same as disabled)', () => {
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

    const trisUndef = withUndefined.pieces.reduce((s, p) => s + p.indices.length / 3, 0);
    const trisDisabled = withDisabled.pieces.reduce((s, p) => s + p.indices.length / 3, 0);
    expect(trisUndef).toBe(trisDisabled);
  }, 60000);

  it('falls back to params.splitConnectors when config arg is undefined', () => {
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

    const trisResult = result.pieces.reduce((s, p) => s + p.indices.length / 3, 0);
    const trisWithout = withoutConnectors.pieces.reduce((s, p) => s + p.indices.length / 3, 0);
    expect(trisResult - trisWithout).toBeGreaterThan(5);
  }, 60000);

  it('wall tongues at 1.6mm wall thickness do not destroy bin geometry', () => {
    const thickWallParams: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 7,
      depth: 3,
      height: 3,
      wallThickness: 1.6,
    };

    // First verify splitting without connectors works fine
    const withoutConnectors = generateSplitPreview(thickWallParams, CUT_PLANES_X, CUT_PLANES_Y, {
      ...DEFAULT_SPLIT_CONNECTOR_CONFIG,
      enabled: false,
    });
    expect(withoutConnectors.pieces).toHaveLength(2);
    const baseVertCount = withoutConnectors.pieces[0].vertices.length;
    expect(baseVertCount).toBeGreaterThan(100);

    // Now with connectors — should NOT destroy geometry
    const result = generateSplitPreview(
      thickWallParams,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DEFAULT_SPLIT_CONNECTOR_CONFIG
    );

    expect(result.pieces).toHaveLength(2);

    const outerW = thickWallParams.width * SIZE - CLEARANCE;
    const halfW = outerW / 2;
    const outerD = thickWallParams.depth * SIZE - CLEARANCE;

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

  it('half-lap joints at 1.2mm walls produce geometry changes (cuts visible)', () => {
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
    const trisWithConn = withConnectors.pieces.reduce((s, p) => s + p.indices.length / 3, 0);
    const trisWithout = withoutConnectors.pieces.reduce((s, p) => s + p.indices.length / 3, 0);
    expect(trisWithConn).toBeGreaterThan(trisWithout);

    // Both pieces should have valid geometry
    for (const piece of withConnectors.pieces) {
      expect(hasNoNaNOrInfinity(piece.vertices)).toBe(true);
      expect(piece.vertices.length).toBeGreaterThan(100);
    }
  }, 60000);

  it('half-lap at 1.2mm walls produces less X-extension than T&G at 1.6mm', () => {
    // At 1.2mm walls, half-lap is subtractive for walls (only floor tongue protrudes).
    // At 1.6mm walls, T&G adds both wall AND floor tongues.
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
    expect(thinMale).toBeDefined();
    expect(thickMale).toBeDefined();

    const thinMaxX = boundingBox(thinMale!.vertices).maxX;
    const thickMaxX = boundingBox(thickMale!.vertices).maxX;

    // T&G adds wall tongues that extend further; half-lap only has floor tongue
    expect(thinMaxX).toBeLessThan(thickMaxX + TESS_TOL);
  }, 60000);

  it('tongue-and-groove activates at 1.6mm walls (male extends past cut face)', () => {
    const thickWallParams: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 7,
      depth: 3,
      height: 3,
      wallThickness: 1.6,
    };
    const withConnectors = generateSplitPreview(
      thickWallParams,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DEFAULT_SPLIT_CONNECTOR_CONFIG
    );
    const withoutConnectors = generateSplitPreview(thickWallParams, CUT_PLANES_X, CUT_PLANES_Y, {
      ...DEFAULT_SPLIT_CONNECTOR_CONFIG,
      enabled: false,
    });

    const maleWith = withConnectors.pieces.find((p) => p.col === 1);
    const maleWithout = withoutConnectors.pieces.find((p) => p.col === 1);
    expect(maleWith).toBeDefined();
    expect(maleWithout).toBeDefined();

    const bbWith = boundingBox(maleWith!.vertices);
    const bbWithout = boundingBox(maleWithout!.vertices);

    // T&G is additive: male piece should extend beyond cut face
    const protrusion = DEFAULT_SPLIT_CONNECTOR_CONFIG.tongueProtrusion;
    const extensionX = bbWith.maxX - bbWithout.maxX;
    expect(extensionX).toBeGreaterThan(protrusion - TESS_TOL - 0.5);
  }, 60000);
});
