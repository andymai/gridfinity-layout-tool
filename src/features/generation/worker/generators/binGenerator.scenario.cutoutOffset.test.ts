// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { cutoutOffset } from './scenarios/cutoutOffset';

runScenarios(cutoutOffset);
