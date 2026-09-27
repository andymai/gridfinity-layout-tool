// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { interiorFillet } from './scenarios/interiorFillet';

runScenarios(interiorFillet);
