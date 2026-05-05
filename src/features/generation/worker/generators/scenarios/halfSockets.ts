import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

export const halfSockets: ScenarioCase[] = [
  { w: 1, d: 1, label: '1\u00d71' },
  { w: 1.5, d: 1.5, label: '1.5\u00d71.5' },
  { w: 2, d: 2, label: '2\u00d72' },
].map(({ w, d, label }) =>
  defineScenario('half-sockets', `${label} with half sockets`, {
    params: {
      width: w,
      depth: d,
      base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true },
    },
  })
);
