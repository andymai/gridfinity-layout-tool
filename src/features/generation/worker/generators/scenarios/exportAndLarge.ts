import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

export const exportMode: ScenarioCase[] = [
  defineScenario('export mode', '2\u00d72 default params (forExport=true)', {
    params: {},
    forExport: true,
    timeout: 60_000,
  }),
];

export const largeBin: ScenarioCase[] = [
  defineScenario('large bin', '8\u00d78 standard', {
    params: { width: 8, depth: 8 },
    timeout: 60_000,
  }),
];

export const asymmetric: ScenarioCase[] = [
  defineScenario('asymmetric dimensions', '0.5\u00d74 extreme asymmetry', {
    params: { width: 0.5, depth: 4 },
  }),
];
