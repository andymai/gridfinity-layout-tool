import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS, GRIDFINITY } from '@/shared/constants/bin';
import { LIP_TIP_MM, LIP_TIP_FLAT_MM } from '@/shared/types/bin';
import { boundingBox } from '../__kernel-tests__/meshAssertions';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import type { LipTipStyle } from '@/shared/types/bin';
import type { CellMask } from '@/shared/utils/cellMask';

const SIZE = GRIDFINITY.GRID_SIZE;
const WIDTH = 2;
const DEPTH = 2;
const HEIGHT = 3;
const NOMINAL_PEAK_Z = HEIGHT * GRIDFINITY.HEIGHT_UNIT + GRIDFINITY.LIP_HEIGHT;

/**
 * How much height each finish may take off the peak, as a [min, max] band.
 *
 * `round` and `chamfer` cut a corner whose two faces are a vertical wall and a
 * 45 degree chamfer, so the tip loses somewhere between `LIP_TIP_MM / 2` and
 * `LIP_TIP_MM * 2` depending on which one — the point of the band is that it is
 * a small, bounded bite out of the peak, not that it equals a particular
 * trigonometric expression. `flat` is a plane cut at a known Z, so its band is
 * tight: the drop IS `LIP_TIP_FLAT_MM`, and anything else means the cutter
 * landed somewhere other than where it was asked to.
 */
const DROP_BANDS: Readonly<Record<Exclude<LipTipStyle, 'sharp'>, readonly [number, number]>> = {
  round: [LIP_TIP_MM / 2, LIP_TIP_MM * 2],
  chamfer: [LIP_TIP_MM / 2, LIP_TIP_MM * 2],
  flat: [LIP_TIP_FLAT_MM - 0.05, LIP_TIP_FLAT_MM + 0.05],
};

const TIPS = ['round', 'chamfer', 'flat'] as const satisfies readonly LipTipStyle[];

/**
 * 3x3 O-shape: outer frame filled, the middle 1u empty. Half-bin resolution,
 * bottom-first rows — the same fixture shape `customShape.ts` uses.
 *
 * A footprint with a hole grows a SECOND peak ring, around the hole, and it has
 * to be finished with the first: a lip treated on the outside and knife-edged
 * around the hole prints exactly the sliver the setting exists to remove. The
 * bounding box is what catches it, because an untreated hole ring still reaches
 * the nominal peak and pins `maxZ` back up there.
 */
const O_SHAPE_MASK: CellMask = {
  cols: 6,
  rows: 6,
  cells: [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1,
  ],
};

export const lipTip: ScenarioCase[] = [
  ...TIPS.map((tip) =>
    defineScenario('lip-tip #4119', `${tip} stacking lip peak`, {
      assert: 'structural',
      params: {
        width: WIDTH,
        depth: DEPTH,
        height: HEIGHT,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true, lipTip: tip },
      },
      customAssert: (result) => {
        const bb = boundingBox(result.vertices);
        const dropped = NOMINAL_PEAK_Z - bb.maxZ;
        const [min, max] = DROP_BANDS[tip];
        expect(dropped).toBeGreaterThan(min);
        expect(dropped).toBeLessThan(max);

        // The treatment eats the tip and stops. Anything that reached the outer
        // wall would narrow the bin, and a bin that no longer fills its cell is
        // exactly the failure a bounding-box height check cannot see.
        expect(bb.maxX - bb.minX).toBeCloseTo(WIDTH * SIZE - GRIDFINITY.TOLERANCE, 3);
        expect(bb.maxY - bb.minY).toBeCloseTo(DEPTH * SIZE - GRIDFINITY.TOLERANCE, 3);
      },
    })
  ),
  defineScenario('lip-tip #4119', 'flat peak reaches an O-shape hole ring', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 3,
      height: HEIGHT,
      cellMask: O_SHAPE_MASK,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true, lipTip: 'flat' },
    },
    customAssert: (result) => {
      const bb = boundingBox(result.vertices);
      const [min, max] = DROP_BANDS.flat;
      expect(NOMINAL_PEAK_Z - bb.maxZ).toBeGreaterThan(min);
      expect(NOMINAL_PEAK_Z - bb.maxZ).toBeLessThan(max);
    },
  }),
];
