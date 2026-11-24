// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { cradle } from './scenarios/cradle';

runScenarios(cradle);
