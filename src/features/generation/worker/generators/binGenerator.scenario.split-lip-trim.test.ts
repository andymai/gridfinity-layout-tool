// @vitest-environment node
/**
 * Scenario tests for stacking lip geometry on split bin pieces.
 *
 * Validates that all split pieces retain the full stacking lip profile,
 * including at interior cut faces — the lip is NOT trimmed.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS, GRIDFINITY } from '@/shared/constants/bin';
import type { BinParams, SplitConnectorConfig } from '@/shared/types/bin';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import { initBrepjs, getGenerateSplitPreview } from './__dual-kernel__/wasmInit';
import { boundingBox } from './__dual-kernel__/meshAssertions';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

// ─── Constants ──────────────────────────────────────────────────────────────

const SIZE = GRIDFINITY.GRID_SIZE;
const CLEARANCE = GRIDFINITY.TOLERANCE;
const LIP_HEIGHT = GRIDFINITY.LIP_HEIGHT;

/** Tessellation tolerance for geometry checks. */
const TESS_TOL = 0.2;

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

// ─── Helpers ────────────────────────────────────────────────────────────────

function maxZ(vertices: Float32Array): number {
  let max = -Infinity;
  for (let i = 0; i < vertices.length; i += 3) {
    max = Math.max(max, vertices[i + 2]);
  }
  return max;
}

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

/** Compute the Y extent of vertices above a given Z threshold. */
function lipYExtent(vertices: Float32Array, zThreshold: number): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < vertices.length; i += 3) {
    if (vertices[i + 2] > zThreshold) {
      min = Math.min(min, vertices[i + 1]);
      max = Math.max(max, vertices[i + 1]);
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error(
      `lipYExtent: no vertices found above zThreshold=${zThreshold}; check test setup/threshold.`
    );
  }
  return { min, max };
}

/** Count triangles with near-zero area above a given Z threshold. */
function countDegenerateTriangles(
  vertices: Float32Array,
  indices: Uint32Array,
  zThreshold: number,
  areaThreshold = 1e-6
): number {
  let count = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const i0 = indices[t] * 3;
    const i1 = indices[t + 1] * 3;
    const i2 = indices[t + 2] * 3;

    const avgZ = (vertices[i0 + 2] + vertices[i1 + 2] + vertices[i2 + 2]) / 3;
    if (avgZ <= zThreshold) continue;

    const ax = vertices[i1] - vertices[i0];
    const ay = vertices[i1 + 1] - vertices[i0 + 1];
    const az = vertices[i1 + 2] - vertices[i0 + 2];
    const bx = vertices[i2] - vertices[i0];
    const by = vertices[i2 + 1] - vertices[i0 + 1];
    const bz = vertices[i2 + 2] - vertices[i0 + 2];

    const cx = ay * bz - az * by;
    const cy = az * bx - ax * bz;
    const cz = ax * by - ay * bx;
    const area = 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);

    if (area < areaThreshold) count++;
  }
  return count;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('stacking lip on split pieces', () => {
  it('all pieces have full stacking lip including at cut faces', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const result = generateSplitPreview(
      OVERSIZED_LIP_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DISABLED_CONNECTORS
    );
    expect(result.pieces).toHaveLength(2);

    const wallTopZ = computeWallTopZ(OVERSIZED_LIP_PARAMS);
    const expectedLipTopZ = wallTopZ + LIP_HEIGHT;

    for (const piece of result.pieces) {
      const pieceMaxZ = maxZ(piece.vertices);
      expect(pieceMaxZ).toBeGreaterThan(expectedLipTopZ - 1.0);
      expect(pieceMaxZ).toBeLessThan(expectedLipTopZ + TESS_TOL);
    }
  }, 60000);

  it('lip extends to full height at cut face edges', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const result = generateSplitPreview(
      OVERSIZED_LIP_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DISABLED_CONNECTORS
    );

    const wallTopZ = computeWallTopZ(OVERSIZED_LIP_PARAMS);
    const outerW = OVERSIZED_LIP_PARAMS.width * SIZE - CLEARANCE;
    const halfPieceW = outerW / 4;

    for (const piece of result.pieces) {
      const cutFaceX = piece.col === 1 ? halfPieceW : -halfPieceW;
      const cutMaxZ = maxZInAxisRange(piece.vertices, 0, cutFaceX - 1, cutFaceX + 1);
      expect(cutMaxZ).toBeGreaterThan(wallTopZ + 1);
    }
  }, 60000);

  it('lip height at outer edge matches GRIDFINITY.LIP_HEIGHT (±tessellation)', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const result = generateSplitPreview(
      OVERSIZED_LIP_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DISABLED_CONNECTORS
    );

    const wallTopZ = computeWallTopZ(OVERSIZED_LIP_PARAMS);

    for (const piece of result.pieces) {
      const bb = boundingBox(piece.vertices);
      const outerEdgeX = piece.col === 1 ? bb.minX : bb.maxX;
      const outerMaxZ = maxZInAxisRange(piece.vertices, 0, outerEdgeX - 1, outerEdgeX + 1);
      const lipExtent = outerMaxZ - wallTopZ;
      expect(lipExtent).toBeGreaterThan(LIP_HEIGHT - 1.0);
      expect(lipExtent).toBeLessThan(LIP_HEIGHT + TESS_TOL);
    }
  }, 60000);

  it('no-lip split pieces have lower max Z than lip split pieces', () => {
    const generateSplitPreview = getGenerateSplitPreview();

    const withLip = generateSplitPreview(
      OVERSIZED_LIP_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DISABLED_CONNECTORS
    );

    const withoutLip = generateSplitPreview(
      OVERSIZED_NO_LIP_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DISABLED_CONNECTORS
    );

    const wallTopZ = computeWallTopZ(OVERSIZED_LIP_PARAMS);

    const lipMaxZ = maxZ(withLip.pieces[0].vertices);
    expect(lipMaxZ).toBeGreaterThan(wallTopZ + 1);

    const noLipMaxZ = maxZ(withoutLip.pieces[0].vertices);
    expect(noLipMaxZ).toBeLessThanOrEqual(wallTopZ + TESS_TOL);
  }, 60000);

  it('split along both axes preserves lip on all 4 pieces', () => {
    const generateSplitPreview = getGenerateSplitPreview();

    const bigBinParams: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 8,
      depth: 8,
      height: 3,
    };

    const result = generateSplitPreview(bigBinParams, [0], [0], DISABLED_CONNECTORS);
    expect(result.pieces).toHaveLength(4);

    const wallTopZ = computeWallTopZ(bigBinParams);

    for (const piece of result.pieces) {
      const bb = boundingBox(piece.vertices);
      const pieceMaxZ = maxZ(piece.vertices);
      expect(pieceMaxZ).toBeGreaterThan(wallTopZ + 1);

      const pieceW = bb.maxX - bb.minX;
      const pieceD = bb.maxY - bb.minY;
      const outerW = bigBinParams.width * SIZE - CLEARANCE;
      const outerD = bigBinParams.depth * SIZE - CLEARANCE;
      expect(pieceW).toBeGreaterThan(outerW / 2 - 2);
      expect(pieceD).toBeGreaterThan(outerD / 2 - 2);
    }
  }, 120000);

  // ─── Regression: lip continuity at cut face (no gap) ─────────────────────

  it.each([
    { width: 2, depth: 7, height: 3 },
    { width: 1, depth: 8, height: 5 },
  ])(
    'lip mesh extends to cut face with no gap (Y-split, $width x $depth h$height)',
    ({ width, depth, height }) => {
      const generateSplitPreview = getGenerateSplitPreview();
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width,
        depth,
        height,
      };
      const outerD = params.depth * SIZE - CLEARANCE;

      // Split along Y at the center
      const result = generateSplitPreview(params, [], [0], DISABLED_CONNECTORS);
      expect(result.pieces).toHaveLength(2);

      const wallTopZ = computeWallTopZ(params);
      const expectedExtentY = outerD / 2; // each piece spans half the bin depth

      for (const piece of result.pieces) {
        const lip = lipYExtent(piece.vertices, wallTopZ);
        const extent = lip.max - lip.min;

        // Lip Y extent should cover at least 95% of the piece depth (no significant gap)
        expect(extent).toBeGreaterThan(expectedExtentY * 0.95 - TESS_TOL);
      }
    },
    60000
  );

  it('no degenerate triangles near cut face in lip zone', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 7,
      height: 3,
    };

    const result = generateSplitPreview(params, [], [0], DISABLED_CONNECTORS);
    const wallTopZ = computeWallTopZ(params);

    for (const piece of result.pieces) {
      // The original bug produced dozens of degenerate triangles; this generous
      // threshold catches regressions while tolerating OCCT tessellation noise.
      const MAX_DEGENERATE_TRIANGLES = 5;
      const degenerateCount = countDegenerateTriangles(piece.vertices, piece.indices, wallTopZ);
      expect(degenerateCount).toBeLessThan(MAX_DEGENERATE_TRIANGLES);
    }
  }, 60000);
});
