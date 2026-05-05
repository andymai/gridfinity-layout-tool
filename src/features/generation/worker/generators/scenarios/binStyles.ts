import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, BinStyle } from '@/shared/types/bin';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

const binStyleList: Array<{ style: BinStyle; base?: Partial<BinParams['base']>; label: string }> = [
  { style: 'standard', label: 'standard' },
  { style: 'slotted', label: 'slotted' },
  { style: 'solid', base: { solid: true }, label: 'solid' },
];

export const binStyles: ScenarioCase[] = binStyleList.map(({ style, base, label }) =>
  defineScenario('bin styles', `2\u00d72 ${label}`, {
    params: { style, base: { ...DEFAULT_BIN_PARAMS.base, ...base } },
  })
);
