// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { labelTabFillet } from './scenarios/labelTabFillet';

runScenarios(labelTabFillet);
