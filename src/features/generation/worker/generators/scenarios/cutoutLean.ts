import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, Cutout } from '@/shared/types/bin';
import { defineScenario, makeCutout } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import { boundingBox, isSolidThrough } from '../__kernel-tests__/meshAssertions';
import type { MeshData } from '@/features/generation/bridge/types';

/**
 * Solid host with no stacking lip, so `boundingBox().maxZ` IS the fill surface
 * (topOffset 0) and every probe band can be anchored on it without restating
 * the height chain. Height 6u leaves solidSurfaceZ well past the deepest
 * cutDepth used here, so no scenario silently clamps. The flat base matters:
 * a socketed bin's coincident socket-top/floor-bottom faces break
 * `verticalSolidSpans` parity (see its docstring), which reads every probe
 * column as void — the flat slab has no such seam.
 */
const SOLID_BASE = {
  ...DEFAULT_BIN_PARAMS.base,
  style: 'flat',
  solid: true,
  stackingLip: false,
} as const;
const HOST = { style: 'solid', base: SOLID_BASE, height: 6 } as const;

const mustCut: NonNullable<ScenarioCase['compareWith']> = {
  params: { ...HOST, cutouts: [] },
  assert: (withCut, noCut) => expect(withCut.triangleCount).toBeGreaterThan(noCut.triangleCount),
};

/** World XY of a cutout's mouth center, derived from the mesh's own outer box
 *  the same way `buildCutoutCuts` derives its origin (interior bottom-left =
 *  −innerW/2), so the probes cannot drift from the placement math. */
function mouthCenter(
  result: MeshData,
  params: BinParams,
  cutout: Pick<Cutout, 'x' | 'y' | 'width' | 'depth'>
): { cx: number; cy: number; topZ: number } {
  const bb = boundingBox(result.vertices);
  const innerW = bb.maxX - bb.minX - 2 * params.wallThickness;
  const innerD = bb.maxY - bb.minY - 2 * params.wallThickness;
  return {
    cx: -innerW / 2 + cutout.x + cutout.width / 2,
    cy: -innerD / 2 + cutout.y + cutout.depth / 2,
    topZ: bb.maxZ,
  };
}

/**
 * The three probes that pin the leaned-pocket geometry, all on the axis the
 * foot travels along (`sign` = which way):
 * 1. mouth fully open at the surface on the hood side — catches a missing
 *    top extension, whose overhang would roof the drawn footprint's far edge;
 * 2. void beyond the drawn footprint at depth on the travel side — the tilt
 *    actually moved the pocket;
 * 3. solid at the mirrored probe — the travel is directional, not a bulge.
 * Probes assume the scenario's 15-ish/18-deep/25–30° proportions; the mid
 * band [top−16, top−12] sits inside the pocket's travel zone for those.
 */
function assertLeanTravel(
  result: MeshData,
  params: BinParams,
  cutout: Pick<Cutout, 'x' | 'y' | 'width' | 'depth'>,
  axis: 'x' | 'y',
  sign: 1 | -1
): void {
  const { cx, cy, topZ } = mouthCenter(result, params, cutout);
  const probe = (off: number): [number, number] => (axis === 'y' ? [cx, cy + off] : [cx + off, cy]);
  const [hx, hy] = probe(sign * -7);
  expect(isSolidThrough(result, hx, hy, topZ - 1, topZ), 'mouth hooded on the high side').toBe(
    false
  );
  const [vx, vy] = probe(sign * 10);
  expect(
    isSolidThrough(result, vx, vy, topZ - 16, topZ - 12),
    'no void where the leaned pocket should reach'
  ).toBe(false);
  const [sx, sy] = probe(sign * -10);
  expect(
    isSolidThrough(result, sx, sy, topZ - 16, topZ - 12),
    'void opposite the lean direction'
  ).toBe(true);
}

const LEANED_RECT = makeCutout({
  shape: 'rectangle',
  x: 20,
  y: 20,
  width: 15,
  depth: 15,
  cutDepth: 18,
  leanDeg: 30,
});

export const cutoutLean: ScenarioCase[] = [
  defineScenario('cutout lean', '2×2 solid, leaned rectangle pocket travels with the lean', {
    params: { ...HOST, cutouts: [LEANED_RECT] },
    compareWith: mustCut,
    customAssert: (result, params) => assertLeanTravel(result, params, LEANED_RECT, 'y', 1),
  }),
  defineScenario('cutout lean', '2×2 solid, negative lean mirrors the travel', {
    params: { ...HOST, cutouts: [{ ...LEANED_RECT, leanDeg: -30 }] },
    compareWith: mustCut,
    customAssert: (result, params) => assertLeanTravel(result, params, LEANED_RECT, 'y', -1),
  }),
  defineScenario('cutout lean', '2×2 solid, rotation carries the lean direction', {
    // rotate(-90°) maps the local +Y travel onto world +X.
    params: { ...HOST, cutouts: [{ ...LEANED_RECT, rotation: 90 }] },
    compareWith: mustCut,
    customAssert: (result, params) => assertLeanTravel(result, params, LEANED_RECT, 'x', 1),
  }),
  defineScenario('cutout lean', '2×2 solid, leaned circle pocket', {
    params: {
      ...HOST,
      cutouts: [
        makeCutout({
          shape: 'circle',
          x: 20,
          y: 20,
          width: 18,
          depth: 18,
          cutDepth: 18,
          leanDeg: 30,
        }),
      ],
    },
    compareWith: mustCut,
    customAssert: (result, params) =>
      assertLeanTravel(result, params, { x: 20, y: 20, width: 18, depth: 18 }, 'y', 1),
  }),
  defineScenario('cutout lean', '2×2 solid, lean composes with entry chamfer', {
    // The chamfer must stay at the mouth (fourth loft section carries the
    // flared rim up through the extension), so the hood probe still passes.
    params: { ...HOST, cutouts: [{ ...LEANED_RECT, leanDeg: 25, chamferWidth: 1.5 }] },
    compareWith: mustCut,
    customAssert: (result, params) => assertLeanTravel(result, params, LEANED_RECT, 'y', 1),
  }),
  defineScenario('cutout lean', '2×2 solid, lean composes with scoop fillet', {
    params: {
      ...HOST,
      cutouts: [{ ...LEANED_RECT, leanDeg: 25, scoopRadiusW: 4, scoopRadiusD: 4 }],
    },
    compareWith: mustCut,
  }),
  defineScenario('cutout lean', '2×2 solid, leaned grid array', {
    params: {
      ...HOST,
      cutouts: [
        makeCutout({
          shape: 'rectangle',
          x: 8,
          y: 8,
          width: 12,
          depth: 12,
          cutDepth: 15,
          leanDeg: 25,
          array: {
            mode: 'grid',
            cols: 2,
            rows: 2,
            pitchX: 30,
            pitchY: 30,
            count: 4,
            radius: 0,
            startAngle: 0,
            rotateToCenter: false,
          },
        }),
      ],
    },
    compareWith: mustCut,
  }),
  defineScenario('cutout lean', '2×2 solid, leaned freeform path pocket', {
    params: {
      ...HOST,
      cutouts: [
        makeCutout({
          shape: 'path',
          x: 20,
          y: 20,
          width: 16,
          depth: 14,
          cutDepth: 15,
          leanDeg: 25,
          path: [
            { x: 20, y: 20, handleIn: null, handleOut: null, symmetric: false },
            { x: 36, y: 20, handleIn: null, handleOut: null, symmetric: false },
            { x: 32, y: 34, handleIn: null, handleOut: null, symmetric: false },
            { x: 24, y: 34, handleIn: null, handleOut: null, symmetric: false },
          ],
        }),
      ],
    },
    compareWith: mustCut,
  }),
  defineScenario('cutout lean', '2×2 solid, leaned union group', {
    params: {
      ...HOST,
      cutouts: [
        {
          ...makeCutout({ x: 15, y: 20, width: 14, depth: 14, cutDepth: 15, leanDeg: 25 }),
          id: 'a',
          groupId: 'g1',
        },
        {
          ...makeCutout({ x: 27, y: 20, width: 14, depth: 14, cutDepth: 15 }),
          id: 'b',
          groupId: 'g1',
        },
      ],
    },
    compareWith: mustCut,
  }),
  defineScenario('cutout lean', '2×2 solid, max lean at full depth clips at the floor', {
    // cutDepth past solidSurfaceZ clamps, and the 45° floor corner would dip
    // below z=0 — the interior clip must truncate it instead of breaching.
    assert: 'structural',
    params: {
      ...HOST,
      height: 4,
      cutouts: [{ ...LEANED_RECT, cutDepth: 40, leanDeg: 45 }],
    },
  }),
];
