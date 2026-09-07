// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { lipTip } from './scenarios/lipTip';

runScenarios(lipTip);
