// @vitest-environment node
/**
 * Scenario tests for splitting a bin that has an overhang.
 *
 * Regression test for #1949: when a bin with an overhang is also large enough
 * to need splitting for the print bed, the boolean cut clipped the overhang off
 * (the cutting bounds were derived from the nominal grid footprint, ignoring the
 * outward overhang expansion). The overhang must survive the split.
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

const SIZE = GRIDFINITY.GRID_SIZE;
const CLEARANCE = GRIDFINITY.TOLERANCE;
const OVERHANG_MM = 18;
/** Tessellation + boolean edge tolerance band. */
const XY_MARGIN = 1.5;

const DISABLED_CONFIG: SplitConnectorConfig = { ...DEFAULT_SPLIT_CONNECTOR_CONFIG, enabled: false };

/** Largest per-piece width (X extent) across the split result, in mm. */
function widestPiece(vertsList: Float32Array[]): number {
  let max = 0;
  for (const v of vertsList) {
    expect(hasNoNaNOrInfinity(v)).toBe(true);
    const bb = boundingBox(v);
    max = Math.max(max, bb.maxX - bb.minX);
  }
  return max;
}

describe('split preserves overhang (#1949)', () => {
  it('keeps a right-side overhang when splitting along the same (X) axis', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 10,
      depth: 2,
      height: 3,
      overhang: { left: 0, right: OVERHANG_MM, front: 0, back: 0 },
    };
    const generateSplitPreview = getGenerateSplitPreview();
    // Cut at x=0 → two pieces along X.
    const result = generateSplitPreview(params, [0], [], DISABLED_CONFIG);

    expect(result.pieces).toHaveLength(2);

    const halfW = (params.width * SIZE - CLEARANCE) / 2;
    // The right piece spans [0, halfW + overhang]; without the fix it is
    // clipped at halfW. Its width must include the overhang.
    const widest = widestPiece(result.pieces.map((p) => p.vertices));
    expect(widest).toBeGreaterThan(halfW + OVERHANG_MM - XY_MARGIN);
  }, 90000);

  it('keeps a side overhang when splitting along the perpendicular (Y) axis (#1949 repro)', () => {
    // 1×7 bin with an 18mm overhang on one side, split across its depth — the
    // exact reported case. Every depth piece must retain the full X overhang.
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 1,
      depth: 7,
      height: 3,
      overhang: { left: 0, right: OVERHANG_MM, front: 0, back: 0 },
    };
    const generateSplitPreview = getGenerateSplitPreview();
    // Cut at y=0 → two pieces along Y; neither split plane touches the X overhang.
    const result = generateSplitPreview(params, [], [0], DISABLED_CONFIG);

    expect(result.pieces).toHaveLength(2);

    const outerW = params.width * SIZE - CLEARANCE;
    for (const piece of result.pieces) {
      const bb = boundingBox(piece.vertices);
      const pieceW = bb.maxX - bb.minX;
      expect(
        pieceW,
        `piece ${piece.label} width ${pieceW.toFixed(1)}mm lost the overhang`
      ).toBeGreaterThan(outerW + OVERHANG_MM - XY_MARGIN);
    }
  }, 90000);
});
