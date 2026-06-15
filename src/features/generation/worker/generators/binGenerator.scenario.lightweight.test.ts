// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { lightweight } from './scenarios/lightweight';

runScenarios(lightweight);
