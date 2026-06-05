// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { binStyles } from './scenarios/binStyles';

runScenarios(binStyles);
