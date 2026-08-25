// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { variantOverrides } from './scenarios/variantOverrides';

runScenarios(variantOverrides);
