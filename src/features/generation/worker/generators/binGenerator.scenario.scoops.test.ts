// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { scoop, scoopLipInteraction } from './scenarios/scoops';

runScenarios([...scoop, ...scoopLipInteraction]);
