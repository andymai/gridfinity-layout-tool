// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { labelTabs } from './scenarios/labelTabs';

runScenarios(labelTabs);
