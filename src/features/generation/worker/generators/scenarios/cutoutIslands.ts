import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, Cutout, PathPoint } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import { defineScenario, makeCutout } from '../__kernel-tests__/scenarioTypes';
import { boundingBox, columnCrossings } from '../__kernel-tests__/meshAssertions';

const FLAT = {
  ...DEFAULT_BIN_PARAMS.base,
  solid: true,
  stackingLip: false,
  style: 'flat',
} as const;

const corner = (x: number, y: number): PathPoint => ({
  x,
  y,
  handleIn: null,
  handleOut: null,
  symmetric: false,
});
const square = (x0: number, y0: number, x1: number, y1: number): PathPoint[] => [
  corner(x0, y0),
  corner(x1, y0),
  corner(x1, y1),
  corner(x0, y1),
];

/** A 40 × 20 pocket 5mm deep with a 10 × 10 island in its middle. */
const POCKET = { x: 20.55, y: 30.55, width: 40, depth: 20 } as const;
const ISLAND = { x0: 35.55, y0: 35.55, x1: 45.55, y1: 45.55 } as const;
const CUT_DEPTH = 5;

function islandPocket(overrides: Partial<Cutout>): Cutout {
  return makeCutout({
    ...POCKET,
    shape: 'path',
    cutDepth: CUT_DEPTH,
    path: square(POCKET.x, POCKET.y, POCKET.x + POCKET.width, POCKET.y + POCKET.depth),
    holes: [square(ISLAND.x0, ISLAND.y0, ISLAND.x1, ISLAND.y1)],
    ...overrides,
  });
}

/** The top of the part along a vertical line at bin-interior (x, y). */
function topAt(result: MeshData, params: BinParams, x: number, y: number): number {
  const bb = boundingBox(result.vertices);
  const innerW = bb.maxX - bb.minX - 2 * params.wallThickness;
  const innerD = bb.maxY - bb.minY - 2 * params.wallThickness;
  const hits = columnCrossings(result, -innerW / 2 + x, -innerD / 2 + y);
  return hits.at(-1) ?? NaN;
}

const islandMidY = (ISLAND.y0 + ISLAND.y1) / 2;

export const cutoutIslands = [
  defineScenario('cutoutIslands', 'an island stands to the full height, shrunk by the clearance', {
    params: {
      style: 'solid',
      base: FLAT,
      height: 3,
      cutouts: [islandPocket({ clearance: 0.4 })],
    },
    forExport: true,
    assert: 'structural',
    customAssert: (result, params) => {
      const surface = topAt(result, params, 10, 10);
      const floor = surface - CUT_DEPTH;
      expect(topAt(result, params, (ISLAND.x0 + ISLAND.x1) / 2, islandMidY)).toBeCloseTo(
        surface,
        1
      );
      expect(topAt(result, params, POCKET.x + 5, islandMidY)).toBeCloseTo(floor, 1);
      // Inside the island's edge but within the clearance: cut to the floor.
      expect(topAt(result, params, ISLAND.x0 + 0.2, islandMidY)).toBeCloseTo(floor, 1);
      expect(topAt(result, params, ISLAND.x0 + 0.6, islandMidY)).toBeCloseTo(surface, 1);
    },
  }),
  defineScenario('cutoutIslands', 'an island takes the entry chamfer on its own top edge', {
    params: {
      style: 'solid',
      base: FLAT,
      height: 3,
      cutouts: [islandPocket({ clearance: 0.4, chamferWidth: 1 })],
    },
    forExport: true,
    assert: 'structural',
    customAssert: (result, params) => {
      const surface = topAt(result, params, 10, 10);
      expect(topAt(result, params, (ISLAND.x0 + ISLAND.x1) / 2, islandMidY)).toBeCloseTo(
        surface,
        1
      );
      // 0.9mm in from the drawn edge, half way across the 45° band that runs
      // from the cleared edge (0.4 in) to the rim (1.4 in).
      expect(topAt(result, params, ISLAND.x0 + 0.9, islandMidY)).toBeCloseTo(surface - 0.5, 1);
    },
  }),
  defineScenario('cutoutIslands', 'an island leans with its pocket', {
    params: {
      style: 'solid',
      base: FLAT,
      height: 3,
      cutouts: [islandPocket({ clearance: 0.4, leanDeg: 20 })],
    },
    forExport: true,
    assert: 'structural',
    customAssert: (result, params) => {
      const surface = topAt(result, params, 10, 10);
      expect(topAt(result, params, (ISLAND.x0 + ISLAND.x1) / 2, islandMidY)).toBeCloseTo(
        surface,
        1
      );
    },
  }),
];
