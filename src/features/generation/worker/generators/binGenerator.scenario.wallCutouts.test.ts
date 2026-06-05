// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { wallCutouts } from './scenarios/wallCutouts';

runScenarios(wallCutouts);
