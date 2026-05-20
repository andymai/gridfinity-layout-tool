import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { assertBoundingBoxMatchesParams } from '../__kernel-tests__/meshAssertions';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

export const wallThickness: ScenarioCase[] = [
  defineScenario('wall thickness', '2×2 thin (0.4mm) walls', {
    params: { wallThickness: 0.4 },
  }),
  defineScenario('wall thickness', '2×2 thick (2.4mm) walls', {
    params: { wallThickness: 2.4 },
  }),

  ...[1.0, 1.2, 1.6, 2.0].map((wt) =>
    defineScenario('wall thickness', `2×2 wall ${wt.toFixed(1)}mm (structural)`, {
      assert: 'structural',
      params: { wallThickness: wt },
      customAssert: (result, params) => {
        assertBoundingBoxMatchesParams(result, params, `wall-${wt.toFixed(1)}mm`);
      },
    })
  ),

  defineScenario('wall thickness', '2×2 thin walls + stacking lip (stability)', {
    assert: 'structural',
    params: {
      wallThickness: 0.4,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    },
    customAssert: (result, params) => {
      assertBoundingBoxMatchesParams(result, params, 'thin+lip');
    },
  }),

  defineScenario('wall thickness', '2×2 thick walls + compartments (inner-volume squeeze)', {
    assert: 'structural',
    params: {
      wallThickness: 2.4,
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 },
    },
    timeout: 60_000,
  }),

  defineScenario('wall thickness', '4×4 thick walls (stress)', {
    assert: 'structural',
    params: { width: 4, depth: 4, wallThickness: 2.4 },
    timeout: 60_000,
    customAssert: (result, params) => {
      assertBoundingBoxMatchesParams(result, params, '4x4-thick');
    },
  }),

  defineScenario('wall thickness', '1×1 thin walls + lip + tall (12u)', {
    assert: 'structural',
    params: {
      width: 1,
      depth: 1,
      height: 12,
      wallThickness: 0.4,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    },
  }),
];
