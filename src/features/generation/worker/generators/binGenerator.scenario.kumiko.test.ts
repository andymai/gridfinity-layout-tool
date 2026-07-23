// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { kumiko } from './scenarios/kumiko';

runScenarios(kumiko);
