// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { heightVariations } from './scenarios/heights';

runScenarios(heightVariations);
