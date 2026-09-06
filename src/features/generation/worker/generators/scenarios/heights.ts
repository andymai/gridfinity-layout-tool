import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { LIP_HEIGHT } from '../generatorConstants';
import {
  assertBoundingBoxMatchesParams,
  assertNoDegenerateTriangles,
  boundingBox,
} from '../__kernel-tests__/meshAssertions';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import type { MeshData } from '@/features/generation/bridge/types';
import type { BinParams } from '@/shared/types/bin';

/**
 * The Gridfinity figure for a lipped bin, to 0.05mm: the body is
 * `height` units of `heightUnitMm` and the lip adds its whole profile on top.
 *
 * Tight on purpose. `assertBoundingBoxMatchesParams` ignores the lip and allows
 * 5mm, so it reads as a height check while being blind to every error the lip
 * can contribute — including the 0.1mm one where the fuse overlap that seats
 * the lip was subtracted from the peak instead of buried in the wall.
 */
function assertLippedHeight(label: string) {
  return (result: MeshData, params: BinParams): void => {
    const bb = boundingBox(result.vertices);
    const actual = bb.maxZ - bb.minZ;
    const expected = params.height * params.heightUnitMm + LIP_HEIGHT;
    if (Math.abs(actual - expected) > 0.05) {
      throw new Error(
        `${label}: expected ${expected.toFixed(2)}mm overall, got ${actual.toFixed(2)}mm. ` +
          `A lipped bin is height*heightUnitMm + LIP_HEIGHT; anything the lip is ` +
          `seated with belongs below its base plane, not off its peak.`
      );
    }
  };
}

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
    customAssert: (result, params) => {
      assertBoundingBoxMatchesParams(result, params, '4x4x6');
    },
  }),

  defineScenario('height', '2×2 3u lipped bin measures the spec 25.4mm', {
    assert: 'structural',
    params: { height: 3, base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true } },
    customAssert: (result, params) => {
      assertLippedHeight('2x2x3-lipped')(result, params);
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
