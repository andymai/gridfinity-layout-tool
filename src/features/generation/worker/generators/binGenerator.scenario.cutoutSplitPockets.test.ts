// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { cutoutSplitPockets } from './scenarios/cutoutSplitPockets';

runScenarios(cutoutSplitPockets);
