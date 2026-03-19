// @vitest-environment node
/**
 * Scenario tests for large bin split export: verifies that bins whose cut
 * planes coincide with socket cell boundaries produce full-height geometry
 * (walls + lip), not just the socket base.
 *
 * Regression test for #1091: 10×5×3u bin with 250mm print bed exports only
 * bottom grids when alignment connectors are enabled.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS, GRIDFINITY } from '@/shared/constants/bin';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { BinParams, SplitConnectorConfig } from '@/shared/types/bin';
import { initBrepjs, getGenerateSplitPreview } from './__dual-kernel__/wasmInit';
import type { SplitPreviewResult } from './__dual-kernel__/wasmInit';
import { boundingBox, hasNoNaNOrInfinity } from './__dual-kernel__/meshAssertions';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

// ─── Constants ──────────────────────────────────────────────────────────────

const SIZE = GRIDFINITY.GRID_SIZE;
const CLEARANCE = GRIDFINITY.TOLERANCE;

/** Tessellation tolerance — geometry vertices may deviate from exact CAD by this amount. */
const TESS_TOL = 0.3;

/** Height tolerance band: TESS_TOL + 1mm margin for boolean edge effects. */
const HEIGHT_MARGIN = TESS_TOL + 1;

/** 10×5×3u bin — X axis exceeds 250mm print bed, split at grid unit 5 -> cut plane at x=0.
 *  This makes the interior cut face coplanar with the socket cell wall between cells 5 and 6. */
const LARGE_BIN_PARAMS: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  width: 10,
  depth: 5,
  height: 3,
};

/** Same dimensions but with half-sockets enabled (commenter scenario). */
const LARGE_BIN_HALF_SOCKETS: BinParams = {
  ...LARGE_BIN_PARAMS,
  base: { ...LARGE_BIN_PARAMS.base, halfSockets: true },
};

/** Same dimensions but without stacking lip (isolate body intersection). */
const LARGE_BIN_NO_LIP: BinParams = {
  ...LARGE_BIN_PARAMS,
  base: { ...LARGE_BIN_PARAMS.base, stackingLip: false },
};

// Cut plane at x=0 (center of 10-wide bin: grid unit 5 -> 5*42 - 210 = 0mm)
const CUT_PLANES_X = [0];
const CUT_PLANES_Y: number[] = [];
const DISABLED_CONFIG: SplitConnectorConfig = { ...DEFAULT_SPLIT_CONNECTOR_CONFIG, enabled: false };

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Expected total height for a bin, optionally including stacking lip. */
function expectedHeight(params: BinParams): number {
  const base = params.height * GRIDFINITY.HEIGHT_UNIT;
  return params.base.stackingLip ? base + GRIDFINITY.LIP_HEIGHT : base;
}

/** Assert all pieces in a split result have the expected full height. */
function assertPiecesFullHeight(result: SplitPreviewResult, params: BinParams): void {
  const expectedH = expectedHeight(params);

  for (const piece of result.pieces) {
    expect(hasNoNaNOrInfinity(piece.vertices)).toBe(true);
    expect(piece.vertices.length).toBeGreaterThan(100);
    expect(piece.indices.length).toBeGreaterThan(0);

    const bb = boundingBox(piece.vertices);
    const pieceH = bb.maxZ - bb.minZ;

    expect(pieceH, `piece ${piece.label} height ${pieceH.toFixed(1)}mm too short`).toBeGreaterThan(
      expectedH - HEIGHT_MARGIN
    );
    expect(pieceH).toBeLessThan(expectedH + HEIGHT_MARGIN);
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('large bin split at coplanar socket boundary (#1091)', () => {
  it('10x5x3u + stacking lip + alignment connectors: full height preserved', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const result = generateSplitPreview(
      LARGE_BIN_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DEFAULT_SPLIT_CONNECTOR_CONFIG
    );

    expect(result.pieces).toHaveLength(2);
    assertPiecesFullHeight(result, LARGE_BIN_PARAMS);

    // Additional sanity checks on first split scenario
    for (const piece of result.pieces) {
      expect(hasNoNaNOrInfinity(piece.normals)).toBe(true);
      expect(hasNoNaNOrInfinity(piece.edgeVertices)).toBe(true);
    }
  }, 90000);

  it('10x5x3u + half-sockets + lip + alignment connectors: full height preserved', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const result = generateSplitPreview(
      LARGE_BIN_HALF_SOCKETS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DEFAULT_SPLIT_CONNECTOR_CONFIG
    );

    expect(result.pieces).toHaveLength(2);
    assertPiecesFullHeight(result, LARGE_BIN_HALF_SOCKETS);
  }, 180000);

  it('10x5x3u + lip, no connectors: isolate body intersection from connector failure', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const result = generateSplitPreview(
      LARGE_BIN_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DISABLED_CONFIG
    );

    expect(result.pieces).toHaveLength(2);
    assertPiecesFullHeight(result, LARGE_BIN_PARAMS);
  }, 90000);

  it('10x5x3u without lip: body intersection preserves full wall height', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const result = generateSplitPreview(
      LARGE_BIN_NO_LIP,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DISABLED_CONFIG
    );

    expect(result.pieces).toHaveLength(2);
    assertPiecesFullHeight(result, LARGE_BIN_NO_LIP);
  }, 90000);

  it('piece bounding boxes have correct XY dimensions (5x5 halves)', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const result = generateSplitPreview(
      LARGE_BIN_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DISABLED_CONFIG
    );

    const outerW = LARGE_BIN_PARAMS.width * SIZE - CLEARANCE;
    const outerD = LARGE_BIN_PARAMS.depth * SIZE - CLEARANCE;
    const halfW = outerW / 2;

    for (const piece of result.pieces) {
      const bb = boundingBox(piece.vertices);
      const pieceW = bb.maxX - bb.minX;
      const pieceD = bb.maxY - bb.minY;

      expect(pieceW).toBeCloseTo(halfW, 0);
      expect(pieceD).toBeCloseTo(outerD, 0);
    }
  }, 90000);
});
