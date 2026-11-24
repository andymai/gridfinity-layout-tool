// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { toolSets } from './scenarios/toolSets';

runScenarios(toolSets);
