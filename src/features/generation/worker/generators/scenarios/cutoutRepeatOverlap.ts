import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { defineScenario, makeCutout } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

const SOLID_BASE = { ...DEFAULT_BIN_PARAMS.base, solid: true };

/**
 * The cut must actually remove material. Structural validity cannot catch a
 * boolean that quietly dropped its tools — an uncut bin is still a valid one —
 * and a dropped tool is the failure mode intersecting cutters would have.
 */
const mustCut: NonNullable<ScenarioCase['compareWith']> = {
  params: { style: 'solid', base: SOLID_BASE, cutouts: [] },
  assert: (withCut, noCut) => expect(withCut.triangleCount).toBeGreaterThan(noCut.triangleCount),
};

/**
 * Repeat spacings the editor's per-axis pitch floor used to make unreachable.
 * The floor was read off the master's bounding box, which refused both a
 * staggered array nesting into the row below and a deliberate overlap.
 */
export const cutoutRepeatOverlap: ScenarioCase[] = [
  // Overlap is a supported ask, not an accident: two shapes cutting into each
  // other IS how one combined opening gets made. The editor stopped clamping
  // the pitch to the master's box, so the kernel now sees tools that intersect
  // and has to fuse them into one cavity rather than fail the boolean.
  defineScenario('cutout repeat overlap', '2\u00d72 solid with an overlapping grid array', {
    params: {
      style: 'solid',
      base: SOLID_BASE,
      cutouts: [
        makeCutout({
          shape: 'circle',
          x: 8,
          y: 8,
          width: 12,
          depth: 12,
          array: {
            mode: 'grid',
            cols: 3,
            rows: 2,
            // Pitch well under the 12mm master: every neighbour intersects.
            pitchX: 8,
            pitchY: 8,
            count: 6,
            radius: 20,
            startAngle: 0,
            rotateToCenter: false,
          },
        }),
      ],
    },
    compareWith: mustCut,
  }),
  // The reported nesting: rows half a pitch apart in X, packed tight in Y.
  // Boxes clear each other, so this is not an overlap — it is the layout the
  // per-axis floor made unreachable.
  defineScenario('cutout repeat overlap', '2\u00d72 solid with a tightly nested staggered array', {
    params: {
      style: 'solid',
      base: SOLID_BASE,
      cutouts: [
        makeCutout({
          shape: 'circle',
          x: 6,
          y: 6,
          width: 10,
          depth: 10,
          array: {
            mode: 'staggered',
            cols: 3,
            rows: 3,
            pitchX: 20,
            pitchY: 6,
            count: 9,
            radius: 20,
            startAngle: 0,
            rotateToCenter: false,
          },
        }),
      ],
    },
    compareWith: mustCut,
  }),
];
