// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { floorPatterns } from './scenarios/floorPatterns';

runScenarios(floorPatterns);
