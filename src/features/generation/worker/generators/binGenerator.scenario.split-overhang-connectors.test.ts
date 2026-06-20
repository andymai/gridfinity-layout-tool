// @vitest-environment node
/**
 * Scenario test for wall connectors on an OVERHUNG perimeter wall of a split bin.
 *
 * Regression: a bin extended with an overhang (#1949) and split with wall
 * connectors ('key') did not get connectors on the overhung wall. The connector
 * placement (`perimeterWalls`) tested each piece's span against the *nominal*
 * grid footprint (±outerW/2), but the pieces were actually cut to the overhung
 * bounds. On the overhung side `pieceMax - nominalHalf === overhang`, so the
 * boundary test failed and the wall was silently skipped.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { BinParams, SplitConnectorConfig } from '@/shared/types/bin';
import { initBrepjs, getGenerateSplitPreview } from './__kernel-tests__/wasmInit';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

const OVERHANG_MM = 18;

/** Wall connectors only (floor scarf off) so triangle deltas isolate the keys. */
const WALL_KEY_ONLY: SplitConnectorConfig = {
  ...DEFAULT_SPLIT_CONNECTOR_CONFIG,
  enabled: false,
  wallConnector: 'key',
};
const NO_CONNECTORS: SplitConnectorConfig = {
  ...DEFAULT_SPLIT_CONNECTOR_CONFIG,
  enabled: false,
  wallConnector: 'none',
};

/** Sum triangle counts across all pieces. */
function totalTris(pieces: { indices: { length: number } }[]): number {
  return pieces.reduce((sum, p) => sum + p.indices.length / 3, 0);
}

describe('wall connectors on an overhung split wall', () => {
  it('generates key connectors on the overhung perimeter wall', () => {
    const generateSplitPreview = getGenerateSplitPreview();

    // 1×4 bin, split across depth (Y). Each Y-cut face spans the full width (X),
    // so its perimeter walls are the left and right X walls. The right wall is
    // pushed out by the overhang.
    const base: BinParams = { ...DEFAULT_BIN_PARAMS, width: 1, depth: 4, height: 3 };
    const overhung: BinParams = {
      ...base,
      overhang: { left: 0, right: OVERHANG_MM, front: 0, back: 0 },
    };

    const cutsX: number[] = [];
    const cutsY = [0];

    // Connector geometry = (key config) − (no-connector baseline), which cancels
    // the body geometry and leaves just the connectors. The overhung delta must
    // be comparable to the symmetric delta — both walls get connectors.
    const flatDelta =
      totalTris(generateSplitPreview(base, cutsX, cutsY, WALL_KEY_ONLY).pieces) -
      totalTris(generateSplitPreview(base, cutsX, cutsY, NO_CONNECTORS).pieces);
    const overhangDelta =
      totalTris(generateSplitPreview(overhung, cutsX, cutsY, WALL_KEY_ONLY).pieces) -
      totalTris(generateSplitPreview(overhung, cutsX, cutsY, NO_CONNECTORS).pieces);

    expect(flatDelta).toBeGreaterThan(0);
    // Without the fix the overhung wall is skipped, roughly halving the delta.
    expect(
      overhangDelta,
      `overhung connector delta ${overhangDelta} vs symmetric ${flatDelta} — ` +
        `overhung wall lost its connector`
    ).toBeGreaterThan(flatDelta * 0.8);
  }, 120000);
});
