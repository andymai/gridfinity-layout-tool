// @vitest-environment node
/**
 * Scenario tests for stacking lip trimming on split bin pieces.
 *
 * Validates that interior cut faces of split pieces do NOT have stacking lip
 * cross-sections, while outer perimeter edges still have the full lip profile.
 *
 * Regression test for: stacking lip appearing on interior cut faces of split bins.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS, GRIDFINITY } from '@/shared/constants/bin';
import type { BinParams, SplitConnectorConfig } from '@/shared/types/bin';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';

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

type GenerateBinFn = (params: BinParams, onProgress?: unknown, forExport?: boolean) => unknown;

let generateSplitPreview: GenerateSplitPreviewFn;
let generateBin: GenerateBinFn;

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
  generateBin = mod.generateBin as GenerateBinFn;
}, 30000);

// Geometry constants derived from shared Gridfinity spec
const SIZE = GRIDFINITY.GRID_SIZE;
const CLEARANCE = GRIDFINITY.TOLERANCE;
const LIP_HEIGHT = GRIDFINITY.LIP_HEIGHT;

/** Compute the Z coordinate of the top of the bin wall (excludes lip). */
function computeWallTopZ(params: BinParams): number {
  return params.height * GRIDFINITY.HEIGHT_UNIT;
}

/** 8x2x3 bin with stacking lip enabled (default). Split along X at x=0. */
const OVERSIZED_LIP_PARAMS: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  width: 8,
  depth: 2,
  height: 3,
};

/** Same bin but with stacking lip disabled for comparison. */
const OVERSIZED_NO_LIP_PARAMS: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  width: 8,
  depth: 2,
  height: 3,
  base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
};

const CUT_PLANES_X = [0];
const CUT_PLANES_Y: number[] = [];
const DISABLED_CONNECTORS: SplitConnectorConfig = {
  ...DEFAULT_SPLIT_CONNECTOR_CONFIG,
  enabled: false,
};

/** Find max Z of vertices where the coordinate at `axis` (0=x, 1=y) is within [min, max]. */
function maxZInAxisRange(vertices: Float32Array, axis: 0 | 1, min: number, max: number): number {
  let result = -Infinity;
  for (let i = 0; i < vertices.length; i += 3) {
    const coord = vertices[i + axis];
    if (coord >= min && coord <= max) {
      result = Math.max(result, vertices[i + 2]);
    }
  }
  return result;
}

/** Find max Z across all vertices. */
function maxZ(vertices: Float32Array): number {
  let max = -Infinity;
  for (let i = 0; i < vertices.length; i += 3) {
    max = Math.max(max, vertices[i + 2]);
  }
  return max;
}

describe('stacking lip trimming on split pieces', () => {
  it('interior cut face has no lip geometry above wallTopZ', () => {
    const result = generateSplitPreview(
      OVERSIZED_LIP_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DISABLED_CONNECTORS
    );
    expect(result.pieces).toHaveLength(2);

    const wallTopZ = computeWallTopZ(OVERSIZED_LIP_PARAMS);
    const outerW = OVERSIZED_LIP_PARAMS.width * SIZE - CLEARANCE;
    const halfPieceW = outerW / 4;

    for (const piece of result.pieces) {
      // The cut face is at |x| ~ halfPieceW (positive for col=1, negative for col=2)
      // Search within 2mm of the cut face (trim zone is LIP_TAPER_WIDTH = 2.6mm)
      const cutFaceX = piece.col === 1 ? halfPieceW : -halfPieceW;
      const searchMargin = 2;

      const maxZNearCutFace =
        cutFaceX > 0
          ? maxZInAxisRange(piece.vertices, 0, cutFaceX - searchMargin, cutFaceX + 1)
          : maxZInAxisRange(piece.vertices, 0, cutFaceX - 1, cutFaceX + searchMargin);

      // Near cut face, max Z should be at or below wallTopZ + tessellation tolerance
      expect(maxZNearCutFace).toBeLessThanOrEqual(wallTopZ + 0.5);
    }
  }, 60000);

  it('outer perimeter edges still have full stacking lip', () => {
    const result = generateSplitPreview(
      OVERSIZED_LIP_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DISABLED_CONNECTORS
    );

    const wallTopZ = computeWallTopZ(OVERSIZED_LIP_PARAMS);
    const expectedLipTopZ = wallTopZ + LIP_HEIGHT;

    for (const piece of result.pieces) {
      // The lip top has a 0.6mm fillet (TOP_FILLET) and preview tessellation
      // uses coarser tolerance, so actual max Z can be ~1mm below theoretical.
      const pieceMaxZ = maxZ(piece.vertices);
      expect(pieceMaxZ).toBeGreaterThan(expectedLipTopZ - 1.0);
    }
  }, 60000);

  it('no-lip split pieces have lower max Z than lip split pieces', () => {
    // Force fresh solid generation for each param set — the module-level
    // solid cache (getLastSolid) persists across calls and would reuse
    // the lip bin for the no-lip test otherwise.
    generateBin(OVERSIZED_LIP_PARAMS, undefined, true);
    const withLip = generateSplitPreview(
      OVERSIZED_LIP_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DISABLED_CONNECTORS
    );

    generateBin(OVERSIZED_NO_LIP_PARAMS, undefined, true);
    const withoutLip = generateSplitPreview(
      OVERSIZED_NO_LIP_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DISABLED_CONNECTORS
    );

    const wallTopZ = computeWallTopZ(OVERSIZED_LIP_PARAMS);

    // With lip: max Z should be above wallTopZ (lip present on outer edges)
    const lipMaxZ = maxZ(withLip.pieces[0].vertices);
    expect(lipMaxZ).toBeGreaterThan(wallTopZ + 1);

    // Without lip: max Z should be at wallTopZ
    const noLipMaxZ = maxZ(withoutLip.pieces[0].vertices);
    expect(noLipMaxZ).toBeLessThanOrEqual(wallTopZ + 0.5);
  }, 60000);

  it('split along both axes also trims lip at all cut faces', () => {
    const bigBinParams: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 8,
      depth: 8,
      height: 3,
    };

    generateBin(bigBinParams, undefined, true);
    const result = generateSplitPreview(bigBinParams, [0], [0], DISABLED_CONNECTORS);
    expect(result.pieces).toHaveLength(4);

    const wallTopZ = computeWallTopZ(bigBinParams);
    const outerW = bigBinParams.width * SIZE - CLEARANCE;
    const outerD = bigBinParams.depth * SIZE - CLEARANCE;
    const halfPieceW = outerW / 4;
    const halfPieceD = outerD / 4;

    // With 2x2 split, every piece is a corner piece — each has 2 outer edges
    // and 2 cut faces. Check cut faces don't have lip.
    for (const piece of result.pieces) {
      const isCutRight = piece.col === 1;
      const isCutTop = piece.row === 1;

      // Check cut face in X direction (search within 2mm — trim zone is LIP_TAPER_WIDTH)
      if (isCutRight) {
        const cutMaxZ = maxZInAxisRange(piece.vertices, 0, halfPieceW - 2, halfPieceW + 1);
        expect(cutMaxZ).toBeLessThanOrEqual(wallTopZ + 0.5);
      }

      // Check cut face in Y direction (search within 2mm of cut face)
      if (isCutTop) {
        const cutMaxZ = maxZInAxisRange(piece.vertices, 1, halfPieceD - 2, halfPieceD + 1);
        expect(cutMaxZ).toBeLessThanOrEqual(wallTopZ + 0.5);
      }

      // Overall max Z should still show lip on outer edges
      const pieceMaxZ = maxZ(piece.vertices);
      expect(pieceMaxZ).toBeGreaterThan(wallTopZ + 1);
    }
  }, 120000);
});
