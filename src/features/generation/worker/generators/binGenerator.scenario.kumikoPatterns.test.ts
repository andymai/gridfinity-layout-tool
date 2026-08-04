// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { kumikoPatterns } from './scenarios/kumiko';

runScenarios(kumikoPatterns);
