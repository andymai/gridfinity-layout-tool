// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { wallPatterns } from './scenarios/wallPatterns';

runScenarios(wallPatterns);
