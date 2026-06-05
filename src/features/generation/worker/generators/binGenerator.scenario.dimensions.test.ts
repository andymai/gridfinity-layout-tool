// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { dimensions } from './scenarios/dimensions';

runScenarios(dimensions);
