// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { tile } from './scenarios/tile';

runScenarios(tile);
