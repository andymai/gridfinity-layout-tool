// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { customShapes } from './scenarios/customShape';

runScenarios(customShapes);
