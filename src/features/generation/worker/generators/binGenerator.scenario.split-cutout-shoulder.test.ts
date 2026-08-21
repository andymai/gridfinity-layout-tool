// @vitest-environment node
/**
 * Regression test for the wall-cutout shoulder on split bins with a lip.
 *
 * A cutout's top round-over is tangent to the top of the material the cut
 * passes through, which on a lipped bin is the stacking lip's top face. Split
 * bins build the body lipless (to dodge an OCCT crash at the lip-wall
 * junction), so the pipeline seated that curve on the WALL top 4.4mm lower
 * while the separately-built lip kept the correct one. The wall was rounded
 * away under a lip that was not, leaving the lip jutting over open air.
 *
 * The measure is a delta against the same bin unsplit: below the lip the two
 * openings have to be the same width at every height, whatever radius the
 * clamps end up allowing.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { BinParams, SplitConnectorConfig, WallCutout } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import { initBrepjs, getGenerateBin, getGenerateSplitPreview } from './__kernel-tests__/wasmInit';
import { isSolidThrough } from './__kernel-tests__/meshAssertions';
import { deriveDimensions } from './pipeline/context';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

const NO_CONNECTORS: SplitConnectorConfig = {
  ...DEFAULT_SPLIT_CONNECTOR_CONFIG,
  enabled: false,
};

/** Radius chosen past LIP_HEIGHT (4.4mm) so the flare reaches down into the wall. */
const SHOULDER_RADIUS = 8;

const SIDE_CUT: WallCutout = {
  enabled: true,
  width: 70,
  depth: 50,
  alignment: 'center',
  offset: 0,
  widthMm: null,
};

const PARAMS: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  width: 4,
  depth: 6,
  height: 5,
  base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
  // Asymmetric overhang on a side without cutouts, as reported: it shifts the
  // interior off centre, so the body cut and the lip cut have to agree about
  // that too.
  overhang: { left: 0, right: 0, front: 0, back: 8, feet: false },
  walls: {
    ...DEFAULT_BIN_PARAMS.walls,
    enabled: true,
    cornerRadiusTop: SHOULDER_RADIUS,
    left: SIDE_CUT,
    right: SIDE_CUT,
  },
};

/** A split piece read as a mesh, for the ray probes. */
function asMesh(piece: {
  vertices: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  edgeVertices: Float32Array;
}): MeshData {
  return { ...piece, triangleCount: piece.indices.length / 3 };
}

/**
 * How far past the cut's nominal edge the wall is still missing, at height `z`.
 *
 * Walks outward along the left wall from the cut edge until the wall goes
 * solid, so a shoulder round-over reads as the distance it has eaten into the
 * material standing beside the opening.
 */
function shoulderCutbackMm(
  probe: (y: number) => boolean,
  cutEdgeY: number,
  step = 0.05,
  limit = 14
): number {
  for (let d = 0; d <= limit; d += step) {
    if (probe(cutEdgeY + d)) return d;
  }
  return Number.NaN;
}

describe('split bin: cutout shoulder is seated on the lip, not the wall top', () => {
  it('matches the unsplit bin at every height below the lip', () => {
    const dim = deriveDimensions(PARAMS, true);
    const whole: MeshData = getGenerateBin()(PARAMS, undefined, true);
    const split = getGenerateSplitPreview()(PARAMS, [], [0], NO_CONNECTORS);
    expect(split.pieces).toHaveLength(2);

    // Mid-thickness of the left wall, and the back-half piece that carries the
    // far end of that wall's cutout.
    const wallX = -dim.innerW / 2 - PARAMS.wallThickness / 2;
    const cutEdgeY = dim.innerOffsetY + (dim.innerD * SIDE_CUT.width) / 100 / 2;
    const piece = split.pieces.reduce((a, b) => (b.offsetY > a.offsetY ? b : a));
    const pieceMesh = asMesh(piece);

    // tessellatePiece re-centres each piece on its own footprint; undo that so
    // both meshes are probed in the same bin frame.
    const pitchX = PARAMS.gridUnitMm;
    const pitchY = PARAMS.gridUnitMm;
    const centerX =
      piece.offsetX * pitchX - (PARAMS.width * pitchX - 0.5) / 2 + (piece.widthUnits * pitchX) / 2;
    const centerY =
      piece.offsetY * pitchY - (PARAMS.depth * pitchY - 0.5) / 2 + (piece.depthUnits * pitchY) / 2;

    for (const depthBelowRim of [1, 2, 3, 4, 5, 6]) {
      const z = dim.wallTopZ - depthBelowRim;
      const band = (mesh: MeshData, x: number, y: number): boolean =>
        isSolidThrough(mesh, x, y, z - 0.1, z);

      const wholeCutback = shoulderCutbackMm((y) => band(whole, wallX, y), cutEdgeY);
      const splitCutback = shoulderCutbackMm(
        (y) => band(pieceMesh, wallX - centerX, y - centerY),
        cutEdgeY
      );

      expect(wholeCutback).not.toBeNaN();
      expect(splitCutback).not.toBeNaN();
      expect(
        Math.abs(splitCutback - wholeCutback),
        `wall top −${depthBelowRim}mm: split piece ${piece.label} is cut back ` +
          `${splitCutback.toFixed(2)}mm past the opening, unsplit bin ${wholeCutback.toFixed(2)}mm`
      ).toBeLessThanOrEqual(0.3);
    }
  }, 120000);
});
