// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { scoop, scoopTwoVariable, scoopSides, scoopLipInteraction } from './scenarios/scoops';

runScenarios([...scoop, ...scoopTwoVariable, ...scoopSides, ...scoopLipInteraction]);
