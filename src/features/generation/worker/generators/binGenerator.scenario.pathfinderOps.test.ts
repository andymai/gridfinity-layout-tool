// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { pathfinderOps } from './scenarios/pathfinderOps';

runScenarios(pathfinderOps);
