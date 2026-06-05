// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { integration } from './scenarios/integration';

runScenarios(integration);
