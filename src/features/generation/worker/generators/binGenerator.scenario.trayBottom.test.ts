// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { trayBottom } from './scenarios/trayBottom';

runScenarios(trayBottom);
