// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { cutoutFingerAccess } from './scenarios/cutoutFingerAccess';

runScenarios(cutoutFingerAccess);
