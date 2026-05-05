import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

export const heightVariations: ScenarioCase[] = [
  defineScenario('height', '2\u00d72 height minimum (2u)', { params: { height: 2 } }),
  defineScenario('height', '2\u00d72 height tall (10u)', { params: { height: 10 } }),
];
