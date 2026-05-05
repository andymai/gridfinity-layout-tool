import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

export const slottedVariations: ScenarioCase[] = [
  defineScenario('slotted variations', 'slotted with Y-axis slots', {
    params: {
      style: 'slotted',
      slotConfig: {
        x: { enabled: false, pitch: 20 },
        y: { enabled: true, pitch: 20 },
        width: 2.0,
        depth: 1.0,
      },
    },
  }),
  defineScenario('slotted variations', 'slotted with both axes', {
    params: {
      style: 'slotted',
      slotConfig: {
        x: { enabled: true, pitch: 20 },
        y: { enabled: true, pitch: 20 },
        width: 2.0,
        depth: 1.0,
      },
    },
  }),
  defineScenario('slotted variations', 'slotted without lip', {
    params: {
      style: 'slotted',
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    },
  }),
];
