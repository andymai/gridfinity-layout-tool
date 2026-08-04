// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { kumikoComposition } from './scenarios/kumikoComposition';

runScenarios(kumikoComposition);
