// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { wallLabelSlots } from './scenarios/wallLabelSlots';

runScenarios(wallLabelSlots);
