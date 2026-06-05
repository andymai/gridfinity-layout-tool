// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { slottedVariations } from './scenarios/slotted';

runScenarios(slottedVariations);
