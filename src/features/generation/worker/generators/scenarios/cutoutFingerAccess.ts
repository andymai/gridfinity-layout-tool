import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, Cutout } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import { defineScenario, makeCutout } from '../__kernel-tests__/scenarioTypes';
import { boundingBox, columnCrossings } from '../__kernel-tests__/meshAssertions';

/** No lip, so the mesh's top IS the fill surface the cuts are measured from. */
const FLAT = {
  ...DEFAULT_BIN_PARAMS.base,
  style: 'flat',
  solid: true,
  stackingLip: false,
} as const;

function bin(...cutouts: Cutout[]): Partial<BinParams> {
  return { style: 'solid', base: FLAT, height: 3, cutouts };
}

/** How far below the top the surface is at a point in the cutout frame. */
function dropAt(result: MeshData, params: BinParams, x: number, y: number): number {
  const bb = boundingBox(result.vertices);
  const innerW = bb.maxX - bb.minX - 2 * params.wallThickness;
  const innerD = bb.maxY - bb.minY - 2 * params.wallThickness;
  const crossings = columnCrossings(result, -innerW / 2 + x, -innerD / 2 + y);
  return bb.maxZ - (crossings.at(-1) ?? 0);
}

const DEPTH = 9;
const HALF = 10;

/**
 * The floor `u` off a 20 mm cut's axis under a fillet of radius `r`: flat
 * where the fillets leave room, then rising along the arc toward the wall.
 */
function floorAt(r: number, u: number): number {
  const flat = HALF - r;
  return u <= flat ? DEPTH : DEPTH - (r - Math.sqrt(r * r - (u - flat) ** 2));
}

// A curved cut takes the deepest fillet that fits, 0.01 mm inside its limit:
// its 9 mm depth, which binds before half its width does, or the wall below
// the entry edge when a 1 mm edge leaves only 8 mm of it.
const FULL = DEPTH - 0.01;
const UNDER_EDGE = DEPTH - 1 - 0.01;

const SLOT = { shape: 'slot', x: 30, y: 20, width: 20, depth: 40, cutDepth: DEPTH } as const;
const ROUND = { shape: 'circle', x: 30, y: 30, width: 20, depth: 20, cutDepth: DEPTH } as const;
/** Both cuts are centred here; probes step off it toward +X. */
const AXIS = { x: 40, y: 40 };

function expectFloor(result: MeshData, params: BinParams, r: number, offsets: number[]): void {
  for (const u of offsets) {
    expect(dropAt(result, params, AXIS.x + u, AXIS.y)).toBeCloseTo(floorAt(r, u), 1);
  }
}

export const cutoutFingerAccess = [
  defineScenario('cutoutFingerAccess', 'curved slot is a trough along its length', {
    params: bin(makeCutout({ ...SLOT, finger: { bottom: 'curved' } })),
    forExport: true,
    assert: 'structural',
    customAssert: (result, params) => {
      expectFloor(result, params, FULL, [0, 3, 6, 8]);
      expect(dropAt(result, params, AXIS.x, 30)).toBeCloseTo(DEPTH, 1);
    },
  }),
  defineScenario('cutoutFingerAccess', 'flat slot keeps a flat floor', {
    params: bin(makeCutout({ ...SLOT, finger: { bottom: 'flat' } })),
    forExport: true,
    assert: 'structural',
    customAssert: (result, params) => {
      for (const u of [0, 6, 9.5]) {
        expect(dropAt(result, params, AXIS.x + u, AXIS.y)).toBeCloseTo(DEPTH, 1);
      }
    },
  }),
  defineScenario('cutoutFingerAccess', 'curved round is a bowl', {
    params: bin(makeCutout({ ...ROUND, finger: { bottom: 'curved' } })),
    forExport: true,
    assert: 'structural',
    customAssert: (result, params) => {
      expectFloor(result, params, FULL, [0, 6, 8]);
      const diagonal = 6 / Math.SQRT2;
      expect(dropAt(result, params, AXIS.x + diagonal, AXIS.y + diagonal)).toBeCloseTo(
        floorAt(FULL, 6),
        1
      );
    },
  }),
  // As "Add finger access" places it: across the front of a deeper pocket,
  // with a 1 mm round entry edge.
  defineScenario('cutoutFingerAccess', 'finger cut beside a pocket keeps its fillet whole', {
    params: bin(
      makeCutout({ id: 'pocket', x: 20, y: 40, width: 60, depth: 20, cutDepth: 10 }),
      makeCutout({
        ...SLOT,
        id: 'finger',
        x: 40,
        finger: { bottom: 'curved' },
        entryProfile: 'round',
        chamferWidth: 1,
      })
    ),
    forExport: true,
    assert: 'structural',
    customAssert: (result, params) => {
      expect(dropAt(result, params, 50, 30)).toBeCloseTo(DEPTH, 1);
      expect(dropAt(result, params, 44, 30)).toBeCloseTo(floorAt(UNDER_EDGE, 6), 1);
      expect(dropAt(result, params, 30, 50)).toBeCloseTo(10, 1);
    },
  }),
];
