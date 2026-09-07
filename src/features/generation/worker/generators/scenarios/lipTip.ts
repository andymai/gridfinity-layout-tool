import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS, GRIDFINITY } from '@/shared/constants/bin';
import { LIP_TIP_MM } from '@/shared/types/bin';
import { boundingBox } from '../__kernel-tests__/meshAssertions';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import type { LipTipStyle } from '@/shared/types/bin';

const SIZE = GRIDFINITY.GRID_SIZE;
const WIDTH = 2;
const DEPTH = 2;
const HEIGHT = 3;
const NOMINAL_PEAK_Z = HEIGHT * GRIDFINITY.HEIGHT_UNIT + GRIDFINITY.LIP_HEIGHT;

/**
 * A finished peak may only shorten the lip. Both treatments cut a corner whose
 * two faces are a vertical wall and a 45 degree chamfer, so the tip loses
 * somewhere between `LIP_TIP_MM / 2` and `LIP_TIP_MM * 2` of height depending on
 * which one — the point of the band is that it is a small, bounded bite out of
 * the peak, not that it equals a particular trigonometric expression. The
 * *outer* face is asserted exactly, because that is what has to stay put: it is
 * the surface a lid's skirt sits flush against and the one a neighbouring bin
 * measures against on a baseplate.
 */
const TIPS: readonly LipTipStyle[] = ['round', 'chamfer'];

export const lipTip: ScenarioCase[] = TIPS.map((tip) =>
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
      expect(dropped).toBeGreaterThan(LIP_TIP_MM / 2);
      expect(dropped).toBeLessThan(LIP_TIP_MM * 2);

      // The treatment eats the tip and stops. Anything that reached the outer
      // wall would narrow the bin, and a bin that no longer fills its cell is
      // exactly the failure a bounding-box height check cannot see.
      expect(bb.maxX - bb.minX).toBeCloseTo(WIDTH * SIZE - GRIDFINITY.TOLERANCE, 3);
      expect(bb.maxY - bb.minY).toBeCloseTo(DEPTH * SIZE - GRIDFINITY.TOLERANCE, 3);
    },
  })
);
