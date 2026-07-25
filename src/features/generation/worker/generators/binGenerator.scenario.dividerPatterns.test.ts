// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { dividerPatterns } from './scenarios/dividerPatterns';

runScenarios(dividerPatterns);
