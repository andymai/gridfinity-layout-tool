// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { slideTray } from './scenarios/slideTray';

runScenarios(slideTray);
