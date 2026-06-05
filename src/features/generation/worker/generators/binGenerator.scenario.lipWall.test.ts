// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { lipWall } from './scenarios/lipWall';

runScenarios(lipWall);
