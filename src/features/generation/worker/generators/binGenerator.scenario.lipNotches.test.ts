// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { lipNotches } from './scenarios/lipNotches';

runScenarios(lipNotches);
