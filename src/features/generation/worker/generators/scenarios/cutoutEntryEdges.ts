import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, Cutout, PathPoint } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import { defineScenario, makeCutout } from '../__kernel-tests__/scenarioTypes';
import { boundingBox, columnCrossings } from '../__kernel-tests__/meshAssertions';

/** No lip, so the mesh's top IS the fill surface the entry edge falls from. */
const FLAT = {
  ...DEFAULT_BIN_PARAMS.base,
  style: 'flat',
  solid: true,
  stackingLip: false,
} as const;
const EDGE = 2;
/** How far outside the pocket wall the probe stands: 30% of the edge. */
const PROBE_OUT = 0.6;

const POCKET = { x: 20, y: 20, width: 30, depth: 20, cutDepth: 10, chamferWidth: EDGE } as const;

function bin(cutout: Cutout): Partial<BinParams> {
  return { style: 'solid', base: FLAT, height: 3, cutouts: [cutout] };
}

/**
 * How far below the top the surface is, `PROBE_OUT` outside the pocket's left
 * wall at its mid-depth: where the entry edge has dropped to there.
 */
function dropOutsideWall(result: MeshData, params: BinParams): number {
  const bb = boundingBox(result.vertices);
  const innerW = bb.maxX - bb.minX - 2 * params.wallThickness;
  const innerD = bb.maxY - bb.minY - 2 * params.wallThickness;
  const x = -innerW / 2 + POCKET.x - PROBE_OUT;
  const y = -innerD / 2 + POCKET.y + POCKET.depth / 2;
  const crossings = columnCrossings(result, x, y);
  return bb.maxZ - (crossings.at(-1) ?? 0);
}

// A chamfer drops `EDGE - PROBE_OUT` there; a quarter round, tangent to the
// top, only `EDGE - sqrt(EDGE² - (EDGE - PROBE_OUT)²)`.
const CHAMFER_DROP = EDGE - PROBE_OUT;
const ROUND_DROP = EDGE - Math.sqrt(EDGE ** 2 - (EDGE - PROBE_OUT) ** 2);

function corner(x: number, y: number): PathPoint {
  return { x, y, handleIn: null, handleOut: null, symmetric: false };
}

export const cutoutEntryEdges = [
  defineScenario('cutoutEntryEdges', 'chamfered entry falls along 45°', {
    params: bin(makeCutout({ ...POCKET })),
    forExport: true,
    assert: 'structural',
    customAssert: (result, params) => {
      expect(dropOutsideWall(result, params)).toBeCloseTo(CHAMFER_DROP, 1);
    },
  }),
  defineScenario('cutoutEntryEdges', 'rounded entry falls along a quarter circle', {
    params: bin(makeCutout({ ...POCKET, entryProfile: 'round' })),
    forExport: true,
    assert: 'structural',
    customAssert: (result, params) => {
      expect(dropOutsideWall(result, params)).toBeCloseTo(ROUND_DROP, 1);
    },
  }),
  defineScenario('cutoutEntryEdges', 'rounded entry on a path outline', {
    params: bin(
      makeCutout({
        ...POCKET,
        shape: 'path',
        entryProfile: 'round',
        path: [corner(20, 20), corner(50, 20), corner(50, 40), corner(20, 40)],
      })
    ),
    forExport: true,
    assert: 'structural',
    customAssert: (result, params) => {
      expect(dropOutsideWall(result, params)).toBeCloseTo(ROUND_DROP, 1);
    },
  }),
  defineScenario('cutoutEntryEdges', 'rounded entry where a pocket opens onto another floor', {
    params: {
      ...bin(makeCutout({ ...POCKET, width: 50, depth: 40, x: 10, y: 10, cutDepth: 4 })),
      cutouts: [
        makeCutout({ id: 'outer', x: 10, y: 10, width: 50, depth: 40, cutDepth: 4 }),
        makeCutout({
          id: 'inner',
          ...POCKET,
          shape: 'circle',
          x: 25,
          y: 20,
          width: 16,
          depth: 16,
          entryProfile: 'round',
        }),
      ],
    },
    forExport: true,
    assert: 'structural',
  }),
];
