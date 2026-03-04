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
import { initBrepjs, getGenerateSplitPreview } from './__test-infra__/wasmInit';
import { boundingBox } from './__test-infra__/meshAssertions';

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
});
