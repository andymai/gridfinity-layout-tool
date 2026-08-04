// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { kumikoWrapping } from './scenarios/kumikoWrapping';

runScenarios(kumikoWrapping);
