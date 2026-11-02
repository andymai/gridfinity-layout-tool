import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, Cutout, PathPoint } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import { fromSplitFrame } from '@/shared/utils/cutoutSplit';
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

/** The drop at a point given in the pocket's own frame. */
function dropIn(result: MeshData, params: BinParams, x: number, y: number): number {
  const pocket = params.cutouts[0];
  const p = fromSplitFrame(pocket, { x, y });
  return dropAt(result, params, p.x, p.y);
}

const DEEP = 10;
const SHALLOW = 5;
/** 40 by 20, centred on (40, 40). */
const POCKET = { x: 20, y: 30, width: 40, depth: 20, cutDepth: DEEP } as const;
/** Across the pocket's middle, upward: side A is the left half. */
const ACROSS = { a: { x: 0, y: -10 }, b: { x: 0, y: 10 } } as const;

function corner(x: number, y: number): PathPoint {
  return { x, y, handleIn: null, handleOut: null, symmetric: false };
}

export const cutoutSplitPockets = [
  defineScenario('cutoutSplitPockets', 'each side cut to its own depth, sharp step', {
    params: bin(makeCutout({ ...POCKET, split: { ...ACROSS, cutDepth: SHALLOW } })),
    forExport: true,
    assert: 'structural',
    customAssert: (result, params) => {
      expect(dropAt(result, params, 30, 40)).toBeCloseTo(DEEP, 1);
      expect(dropAt(result, params, 50, 40)).toBeCloseTo(SHALLOW, 1);
      expect(dropAt(result, params, 39.6, 40)).toBeCloseTo(DEEP, 1);
      expect(dropAt(result, params, 40.4, 40)).toBeCloseTo(SHALLOW, 1);
    },
  }),
  defineScenario('cutoutSplitPockets', 'side B can be the deeper one', {
    params: bin(makeCutout({ ...POCKET, cutDepth: SHALLOW, split: { ...ACROSS, cutDepth: DEEP } })),
    forExport: true,
    assert: 'structural',
    customAssert: (result, params) => {
      expect(dropAt(result, params, 30, 40)).toBeCloseTo(SHALLOW, 1);
      expect(dropAt(result, params, 50, 40)).toBeCloseTo(DEEP, 1);
    },
  }),
  // The line turns with the pocket: probed through the editor's own mapping.
  defineScenario('cutoutSplitPockets', 'a turned, chamfered round keeps its sides', {
    params: bin(
      makeCutout({
        ...POCKET,
        shape: 'circle',
        rotation: 30,
        chamferWidth: 1,
        split: { a: { x: -10, y: -10 }, b: { x: 10, y: 10 }, cutDepth: SHALLOW },
      })
    ),
    forExport: true,
    assert: 'structural',
    customAssert: (result, params) => {
      expect(dropIn(result, params, -8, 2)).toBeCloseTo(DEEP, 1);
      expect(dropIn(result, params, 8, -2)).toBeCloseTo(SHALLOW, 1);
    },
  }),
  defineScenario('cutoutSplitPockets', 'scooped sides keep flat floors at their depths', {
    params: bin(makeCutout({ ...POCKET, scoopRadius: 3, split: { ...ACROSS, cutDepth: SHALLOW } })),
    forExport: true,
    assert: 'structural',
    customAssert: (result, params) => {
      expect(dropAt(result, params, 30, 40)).toBeCloseTo(DEEP, 1);
      expect(dropAt(result, params, 50, 40)).toBeCloseTo(SHALLOW, 1);
    },
  }),
  defineScenario('cutoutSplitPockets', 'a path outline splits too', {
    params: bin(
      makeCutout({
        ...POCKET,
        shape: 'path',
        path: [corner(20, 30), corner(60, 30), corner(60, 50), corner(20, 50)],
        split: { ...ACROSS, cutDepth: SHALLOW },
      })
    ),
    forExport: true,
    assert: 'structural',
    customAssert: (result, params) => {
      expect(dropAt(result, params, 30, 40)).toBeCloseTo(DEEP, 1);
      expect(dropAt(result, params, 50, 40)).toBeCloseTo(SHALLOW, 1);
    },
  }),
  defineScenario('cutoutSplitPockets', 'every copy of a repeat is split', {
    params: bin(
      makeCutout({
        ...POCKET,
        y: 10,
        array: {
          mode: 'grid',
          cols: 1,
          rows: 2,
          pitchX: 0,
          pitchY: 30,
          count: 0,
          radius: 0,
          startAngle: 0,
          rotateToCenter: false,
        },
        split: { ...ACROSS, cutDepth: SHALLOW },
      })
    ),
    forExport: true,
    assert: 'structural',
    customAssert: (result, params) => {
      for (const y of [20, 50]) {
        expect(dropAt(result, params, 30, y)).toBeCloseTo(DEEP, 1);
        expect(dropAt(result, params, 50, y)).toBeCloseTo(SHALLOW, 1);
      }
    },
  }),
  defineScenario('cutoutSplitPockets', 'a split at one depth cuts one floor', {
    params: bin(makeCutout({ ...POCKET, split: { ...ACROSS, cutDepth: DEEP } })),
    forExport: true,
    assert: 'structural',
    customAssert: (result, params) => {
      for (const x of [30, 40, 50]) expect(dropAt(result, params, x, 40)).toBeCloseTo(DEEP, 1);
    },
  }),
];
