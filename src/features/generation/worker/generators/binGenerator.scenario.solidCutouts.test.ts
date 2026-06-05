// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { solidCutouts } from './scenarios/solidCutouts';

runScenarios(solidCutouts);
