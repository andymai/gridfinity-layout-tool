import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BaseStyle } from '@/shared/types/bin';
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

export const baseStyles: ScenarioCase[] = baseStyleList.flatMap(({ style, label }) => [
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
]);
