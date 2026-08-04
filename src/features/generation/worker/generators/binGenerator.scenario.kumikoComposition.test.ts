// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { kumikoComposition } from './scenarios/kumiko';

runScenarios(kumikoComposition);
