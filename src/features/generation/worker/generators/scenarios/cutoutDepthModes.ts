import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, Cutout } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import { defineScenario, makeCutout } from '../__kernel-tests__/scenarioTypes';
import { boundingBox, columnCrossings } from '../__kernel-tests__/meshAssertions';

const SOCKETED = { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false } as const;
const FLAT = { ...SOCKETED, style: 'flat' } as const;

/**
 * A 2×2 bin is 81.1mm inside, so a 20mm pocket at x=y=10.55 is centred on the
 * front-left cell (41.5mm pitch, centre 20.55mm in): over the middle of one
 * socket, clear of its magnet holes and of the seams between sockets, which
 * are the two places a column probe would read the socket's own geometry.
 */
const POCKET = { x: 10.55, y: 10.55, width: 20, depth: 20 } as const;

function pocketColumn(result: MeshData, params: BinParams): { x: number; y: number } {
  const bb = boundingBox(result.vertices);
  const innerW = bb.maxX - bb.minX - 2 * params.wallThickness;
  const innerD = bb.maxY - bb.minY - 2 * params.wallThickness;
  return {
    x: -innerW / 2 + POCKET.x + POCKET.width / 2,
    y: -innerD / 2 + POCKET.y + POCKET.depth / 2,
  };
}

function pocket(overrides: Partial<Cutout>): Cutout {
  return makeCutout({ ...POCKET, cutDepth: 5, ...overrides });
}

/** Nothing at all along the column: the opening runs out of the underside. */
function assertOpenThrough(result: MeshData, params: BinParams): void {
  const { x, y } = pocketColumn(result, params);
  expect(columnCrossings(result, x, y)).toEqual([]);
  // The probe sits where the bin is: just outside the pocket there is plastic.
  expect(columnCrossings(result, x + POCKET.width, y).length).toBeGreaterThan(0);
}

export const cutoutDepthModes = [
  defineScenario('cutoutDepthModes', 'through cut opens a socketed bin to the bed', {
    params: {
      style: 'solid',
      base: SOCKETED,
      height: 4,
      cutouts: [pocket({ depthMode: 'through' })],
    },
    forExport: true,
    assert: 'structural',
    customAssert: assertOpenThrough,
  }),
  defineScenario('cutoutDepthModes', 'through cut opens a flat bin to the bed', {
    params: {
      style: 'solid',
      base: FLAT,
      height: 4,
      cutouts: [pocket({ depthMode: 'through' })],
    },
    forExport: true,
    assert: 'structural',
    customAssert: assertOpenThrough,
  }),
  defineScenario('cutoutDepthModes', 'repeated through cuts each open to the bed', {
    params: {
      style: 'solid',
      base: SOCKETED,
      height: 4,
      cutouts: [
        pocket({
          depthMode: 'through',
          array: {
            mode: 'grid',
            cols: 2,
            rows: 1,
            pitchX: 41.5,
            pitchY: 0,
            count: 2,
            radius: 0,
            startAngle: 0,
            rotateToCenter: false,
          },
        }),
      ],
    },
    forExport: true,
    assert: 'structural',
    customAssert: (result, params) => {
      assertOpenThrough(result, params);
      const { x, y } = pocketColumn(result, params);
      expect(columnCrossings(result, x + 41.5, y)).toEqual([]);
    },
  }),
  defineScenario('cutoutDepthModes', 'leaning floored pocket keeps its low edge on the floor', {
    params: {
      style: 'solid',
      base: FLAT,
      height: 3,
      cutouts: [
        pocket({ x: 25.55, y: 30.55, depth: 20, leanDeg: 30, depthMode: 'floor', floorMm: 8 }),
      ],
    },
    forExport: true,
    assert: 'structural',
    customAssert: (result) => {
      // On a flat solid bin every vertex above the bed belongs to the top or
      // to the pocket, so the lowest of them is the pocket floor's low edge.
      let lowest = Infinity;
      for (let i = 2; i < result.vertices.length; i += 3) {
        const z = result.vertices[i];
        if (z > 0.5 && z < lowest) lowest = z;
      }
      expect(lowest).toBeCloseTo(8, 1);
    },
  }),
  defineScenario(
    'cutoutDepthModes',
    'leaning floored path keeps its cleared low edge on the floor',
    {
      params: {
        style: 'solid',
        base: FLAT,
        height: 3,
        cutouts: [
          pocket({
            shape: 'path',
            x: 25.55,
            y: 30.55,
            width: 20,
            depth: 20,
            clearance: 2,
            leanDeg: 30,
            depthMode: 'floor',
            floorMm: 8,
            path: [
              { x: 25.55, y: 30.55, handleIn: null, handleOut: null, symmetric: false },
              { x: 45.55, y: 30.55, handleIn: null, handleOut: null, symmetric: false },
              { x: 45.55, y: 50.55, handleIn: null, handleOut: null, symmetric: false },
              { x: 25.55, y: 50.55, handleIn: null, handleOut: null, symmetric: false },
            ],
          }),
        ],
      },
      forExport: true,
      assert: 'structural',
      customAssert: (result) => {
        let lowest = Infinity;
        for (let i = 2; i < result.vertices.length; i += 3) {
          const z = result.vertices[i];
          if (z > 0.5 && z < lowest) lowest = z;
        }
        expect(lowest).toBeCloseTo(8, 1);
      },
    }
  ),
  defineScenario('cutoutDepthModes', 'floored pocket keeps its floor above the underside', {
    params: {
      style: 'solid',
      base: SOCKETED,
      height: 4,
      cutouts: [pocket({ depthMode: 'floor', floorMm: 9 })],
    },
    forExport: true,
    assert: 'structural',
    customAssert: (result, params) => {
      const { x, y } = pocketColumn(result, params);
      const crossings = columnCrossings(result, x, y);
      expect(crossings[0]).toBeCloseTo(0, 1);
      expect(crossings.at(-1)).toBeCloseTo(9, 1);
    },
  }),
];
