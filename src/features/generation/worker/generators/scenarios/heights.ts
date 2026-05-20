import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import {
  assertBoundingBoxMatchesParams,
  assertNoDegenerateTriangles,
} from '../__kernel-tests__/meshAssertions';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

export const heightVariations: ScenarioCase[] = [
  defineScenario('height', '2×2 height minimum (2u)', { params: { height: 2 } }),
  defineScenario('height', '2×2 height tall (10u)', { params: { height: 10 } }),

  ...[3, 4, 5, 6, 8, 15, 20].map((h) =>
    defineScenario('height', `2×2 height ${h}u (structural)`, {
      assert: 'structural',
      params: { height: h },
      customAssert: (result, params) => {
        assertBoundingBoxMatchesParams(result, params, `height-${h}u`);
      },
    })
  ),

  defineScenario('height', '1×1 height 20u (tall + narrow)', {
    assert: 'structural',
    params: { width: 1, depth: 1, height: 20 },
    customAssert: (result, params) => {
      assertBoundingBoxMatchesParams(result, params, '1x1x20');
      assertNoDegenerateTriangles(result, '1x1x20');
    },
  }),

  defineScenario('height', '4×4 height 6u (wide + tall, stress)', {
    assert: 'structural',
    params: { width: 4, depth: 4, height: 6 },
    timeout: 60_000,
    customAssert: (result, params) => {
      assertBoundingBoxMatchesParams(result, params, '4x4x6');
    },
  }),

  defineScenario('height', '2×2 height 2u no lip', {
    assert: 'structural',
    params: { height: 2, base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false } },
    customAssert: (result, params) => {
      assertBoundingBoxMatchesParams(result, params, '2x2x2-nolip');
    },
  }),

  defineScenario('height', '2×2 height 20u no lip', {
    assert: 'structural',
    params: { height: 20, base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false } },
    customAssert: (result, params) => {
      assertBoundingBoxMatchesParams(result, params, '2x2x20-nolip');
    },
  }),
];
