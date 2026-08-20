// @vitest-environment node
/**
 * A split bin's stacking lip is built fresh in `splitBinBuilder` rather than
 * coming out of the pipeline, so anything cut into it has to be positioned in
 * the same interior frame the body was.
 *
 * An overhang moves that frame: it widens the interior and, when the two
 * opposite sides differ, shifts its centre. Sizing the lip's cutters off the
 * nominal footprint instead left a wall cutout passing through the body at one
 * X and through the lip at another — a rim visibly offset from the wall under
 * it. Invisible for a small overhang, because the cutter overshoots its own
 * opening by more than that.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { BinParams, SplitConnectorConfig } from '@/shared/types/bin';
import { initBrepjs, getGenerateSplitPreview } from './__kernel-tests__/wasmInit';
import type { SplitPreviewPiece } from './__kernel-tests__/wasmInit';
import { boundingBox, isSolidThrough } from './__kernel-tests__/meshAssertions';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

const NO_CONNECTORS: SplitConnectorConfig = { ...DEFAULT_SPLIT_CONNECTOR_CONFIG, enabled: false };

const WALL_BAND: readonly [number, number] = [14, 17];
const LIP_BAND: readonly [number, number] = [21.6, 23];
const SCAN_STEP = 0.25;

/**
 * Every X where the front wall changes between solid and open, walking left to
 * right in the given Z band.
 *
 * Comparing edges rather than counting material is what makes this specific:
 * the defect moved the opening without changing how much of it there was, so a
 * volume or vertex count reads the same either way.
 */
function openingEdges(
  piece: SplitPreviewPiece,
  y: number,
  band: readonly [number, number]
): number[] {
  // A split piece carries no triangleCount; the probes only read vertices and
  // indices, so supply it rather than widen their signature.
  const mesh = { ...piece, triangleCount: piece.indices.length / 3 };
  const bb = boundingBox(mesh.vertices);
  const edges: number[] = [];
  let previous: boolean | null = null;
  for (let x = bb.minX + 1; x < bb.maxX - 1; x += SCAN_STEP) {
    const solid = isSolidThrough(mesh, x, y, band[0], band[1]);
    if (previous !== null && solid !== previous) edges.push(x);
    previous = solid;
  }
  return edges;
}

function splitWithOverhangLeft(leftMm: number): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 6,
    depth: 2,
    height: 3,
    overhang: { left: leftMm, right: 0, front: 0, back: 0, feet: false },
    walls: {
      ...DEFAULT_BIN_PARAMS.walls,
      enabled: true,
      front: {
        enabled: true,
        width: 40,
        depth: 90,
        alignment: 'center',
        offset: 0,
        widthMm: null,
      },
      back: { enabled: false, width: 0, depth: 0, alignment: 'center', offset: 0, widthMm: null },
    },
  };
}

describe('split bin: the lip follows the overhang the body was built with', () => {
  it.each([0, 12])(
    'cuts the lip and the wall at the same X with a %imm left overhang',
    (leftMm) => {
      const pieces = getGenerateSplitPreview()(
        splitWithOverhangLeft(leftMm),
        [0],
        [],
        NO_CONNECTORS
      ).pieces;
      expect(pieces).toHaveLength(2);

      for (const piece of pieces) {
        // Mid-thickness of the front wall, which the cutout passes through.
        const y = boundingBox(piece.vertices).minY + DEFAULT_BIN_PARAMS.wallThickness / 2;
        const wall = openingEdges(piece, y, WALL_BAND);
        const lip = openingEdges(piece, y, LIP_BAND);

        expect(lip, `piece ${piece.label}: edge count`).toHaveLength(wall.length);
        expect(wall.length, `piece ${piece.label}: expected an opening to compare`).toBeGreaterThan(
          0
        );
        for (let i = 0; i < wall.length; i++) {
          // One scan step of slack: the two bands are sampled independently.
          expect(
            Math.abs(lip[i] - wall[i]),
            `piece ${piece.label}: lip edge ${lip[i].toFixed(2)} vs wall edge ${wall[i].toFixed(2)}`
          ).toBeLessThanOrEqual(SCAN_STEP);
        }
      }
    },
    120000
  );
});
