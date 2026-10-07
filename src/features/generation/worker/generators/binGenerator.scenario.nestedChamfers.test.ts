// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { nestedChamfers } from './scenarios/nestedChamfers';

runScenarios(nestedChamfers);
