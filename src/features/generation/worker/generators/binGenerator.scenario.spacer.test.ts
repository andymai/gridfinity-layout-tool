// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { spacer } from './scenarios/spacer';

runScenarios(spacer);
