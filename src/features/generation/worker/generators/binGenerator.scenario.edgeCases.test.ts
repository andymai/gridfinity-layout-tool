// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { edgeCases } from './scenarios/edgeCases';

runScenarios(edgeCases);
