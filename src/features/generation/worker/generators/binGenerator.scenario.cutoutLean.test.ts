// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { cutoutLean } from './scenarios/cutoutLean';

runScenarios(cutoutLean);
