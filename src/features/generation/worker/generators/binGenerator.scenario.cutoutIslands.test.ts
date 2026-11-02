// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { cutoutIslands } from './scenarios/cutoutIslands';

runScenarios(cutoutIslands);
