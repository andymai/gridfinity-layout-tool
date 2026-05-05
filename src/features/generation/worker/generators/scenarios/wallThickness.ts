import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

export const wallThickness: ScenarioCase[] = [
  defineScenario('wall thickness', '2\u00d72 thin (0.4mm) walls', {
    params: { wallThickness: 0.4 },
  }),
  defineScenario('wall thickness', '2\u00d72 thick (2.4mm) walls', {
    params: { wallThickness: 2.4 },
  }),
];
