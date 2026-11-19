// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { wallCutoutPaths } from './scenarios/wallCutoutPaths';

runScenarios(wallCutoutPaths);
