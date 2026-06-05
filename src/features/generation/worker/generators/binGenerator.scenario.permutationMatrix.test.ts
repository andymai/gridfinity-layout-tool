// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { permutationMatrix } from './scenarios/permutationMatrix';

runScenarios(permutationMatrix);
