import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BaseStyle } from '@/shared/types/bin';
import {
  assertBoundingBoxMatchesParams,
  assertNoDegenerateTriangles,
} from '../__kernel-tests__/meshAssertions';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

const baseStyleList: Array<{ style: BaseStyle; label: string }> = [
  { style: 'standard', label: 'standard' },
  { style: 'magnet', label: 'magnet' },
  { style: 'screw', label: 'screw' },
  { style: 'magnet_and_screw', label: 'magnet+screw' },
  { style: 'weighted', label: 'weighted' },
  { style: 'flat', label: 'flat' },
];

export const baseStyles: ScenarioCase[] = [
  ...baseStyleList.flatMap(({ style, label }) => [
    defineScenario('base styles', `${label} base with lip`, {
      params: {
        width: 1,
        depth: 1,
        base: { ...DEFAULT_BIN_PARAMS.base, style, stackingLip: true },
      },
    }),
    defineScenario('base styles', `${label} base no lip`, {
      params: {
        width: 1,
        depth: 1,
        base: { ...DEFAULT_BIN_PARAMS.base, style, stackingLip: false },
      },
    }),
  ]),

  ...baseStyleList.map(({ style, label }) =>
    defineScenario('base styles', `${label} base at 4×4 (stress)`, {
      assert: 'structural',
      params: {
        width: 4,
        depth: 4,
        base: { ...DEFAULT_BIN_PARAMS.base, style },
      },
      timeout: 60_000,
      customAssert: (result, params) => {
        assertBoundingBoxMatchesParams(result, params, `4x4-${label}`);
      },
    })
  ),

  ...baseStyleList
    .filter(({ style }) => style !== 'flat')
    .map(({ style, label }) =>
      defineScenario('base styles', `${label} base + half sockets`, {
        assert: 'structural',
        params: {
          base: {
            ...DEFAULT_BIN_PARAMS.base,
            style,
            halfSockets: true,
          },
        },
      })
    ),

  defineScenario('base styles', '0.5×0.5 standard base (minimum half-bin)', {
    assert: 'structural',
    params: {
      width: 0.5,
      depth: 0.5,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'standard' },
    },
  }),

  defineScenario('base styles', '0.5×0.5 flat base no lip (degenerate-guard)', {
    assert: 'structural',
    params: {
      width: 0.5,
      depth: 0.5,
      base: {
        ...DEFAULT_BIN_PARAMS.base,
        style: 'flat',
        stackingLip: false,
      },
    },
    customAssert: (result) => {
      assertNoDegenerateTriangles(result, '0.5x0.5-flat-nolip');
    },
  }),

  defineScenario('base styles', '1.5×2.5 fractional + screw base', {
    assert: 'structural',
    params: {
      width: 1.5,
      depth: 2.5,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'screw' },
    },
  }),
];
