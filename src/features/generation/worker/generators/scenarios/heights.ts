import { defineScenario } from '../__dual-kernel__/scenarioTypes';
import type { ScenarioCase } from '../__dual-kernel__/scenarioTypes';

export const heightVariations: ScenarioCase[] = [
  defineScenario('height', '2\u00d72 height minimum (2u)', { params: { height: 2 } }),
  defineScenario('height', '2\u00d72 height tall (10u)', { params: { height: 10 } }),
];
