// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { cutoutRepeatOverlap } from './scenarios/cutoutRepeatOverlap';

runScenarios(cutoutRepeatOverlap);
