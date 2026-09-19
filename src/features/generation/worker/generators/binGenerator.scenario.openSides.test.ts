// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { openSides } from './scenarios/openSides';

runScenarios(openSides);
