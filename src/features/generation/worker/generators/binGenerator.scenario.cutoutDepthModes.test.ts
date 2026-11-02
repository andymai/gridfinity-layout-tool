// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { cutoutDepthModes } from './scenarios/cutoutDepthModes';

runScenarios(cutoutDepthModes);
