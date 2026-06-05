// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { wallThickness } from './scenarios/wallThickness';

runScenarios(wallThickness);
