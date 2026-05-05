import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

const dimensionCombos: Array<{ w: number; d: number; label: string }> = [
  { w: 0.5, d: 0.5, label: '0.5\u00d70.5' },
  { w: 1, d: 1, label: '1\u00d71' },
  { w: 2, d: 2, label: '2\u00d72' },
  { w: 4, d: 4, label: '4\u00d74' },
  { w: 1.5, d: 2, label: '1.5\u00d72 fractional' },
];

export const dimensions: ScenarioCase[] = dimensionCombos.flatMap(({ w, d, label }) => [
  defineScenario('dimensions', `${label} with lip`, {
    params: { width: w, depth: d, base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true } },
  }),
  defineScenario('dimensions', `${label} no lip`, {
    params: { width: w, depth: d, base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false } },
  }),
]);
