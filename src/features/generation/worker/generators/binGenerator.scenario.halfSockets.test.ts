// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { halfSockets } from './scenarios/halfSockets';

runScenarios(halfSockets);
