// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { slottedFillet } from './scenarios/slottedFillet';

runScenarios(slottedFillet);
