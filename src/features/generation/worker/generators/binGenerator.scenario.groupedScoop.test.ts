// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { groupedScoop } from './scenarios/groupedScoop';

runScenarios(groupedScoop);
