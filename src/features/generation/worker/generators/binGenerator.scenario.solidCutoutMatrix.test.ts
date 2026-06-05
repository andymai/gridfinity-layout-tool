// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { solidCutoutMatrix } from './scenarios/solidCutoutMatrix';

runScenarios(solidCutoutMatrix);
