import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, BinStyle } from '@/shared/types/bin';
import { assertBoundingBoxMatchesParams } from '../__kernel-tests__/meshAssertions';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

const binStyleList: Array<{ style: BinStyle; base?: Partial<BinParams['base']>; label: string }> = [
  { style: 'standard', label: 'standard' },
  { style: 'slotted', label: 'slotted' },
  { style: 'solid', base: { solid: true }, label: 'solid' },
];

export const binStyles: ScenarioCase[] = [
  ...binStyleList.map(({ style, base, label }) =>
    defineScenario('bin styles', `2×2 ${label}`, {
      params: { style, base: { ...DEFAULT_BIN_PARAMS.base, ...base } },
    })
  ),

  ...binStyleList.map(({ style, base, label }) =>
    defineScenario('bin styles', `2×2 ${label} no lip`, {
      assert: 'structural',
      params: {
        style,
        base: { ...DEFAULT_BIN_PARAMS.base, ...base, stackingLip: false },
      },
      customAssert: (result, params) => {
        assertBoundingBoxMatchesParams(result, params, `${label}-nolip`);
      },
    })
  ),

  ...binStyleList.map(({ style, base, label }) =>
    defineScenario('bin styles', `4×4 ${label} (stress)`, {
      assert: 'structural',
      params: {
        width: 4,
        depth: 4,
        style,
        base: { ...DEFAULT_BIN_PARAMS.base, ...base },
      },
      timeout: 60_000,
      customAssert: (result, params) => {
        assertBoundingBoxMatchesParams(result, params, `4x4-${label}`);
      },
    })
  ),

  defineScenario('bin styles', '2×2 solid + halfSockets', {
    assert: 'structural',
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, halfSockets: true },
    },
  }),

  defineScenario('bin styles', '2×2 slotted + magnet base', {
    assert: 'structural',
    params: {
      style: 'slotted',
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet' },
    },
  }),

  defineScenario('bin styles', '1×1 slotted + tall (8u)', {
    assert: 'structural',
    params: {
      width: 1,
      depth: 1,
      height: 8,
      style: 'slotted',
    },
  }),

  defineScenario('bin styles', '2×2 solid + flat base + no lip', {
    assert: 'structural',
    params: {
      style: 'solid',
      base: {
        ...DEFAULT_BIN_PARAMS.base,
        solid: true,
        style: 'flat',
        stackingLip: false,
      },
    },
  }),
];
