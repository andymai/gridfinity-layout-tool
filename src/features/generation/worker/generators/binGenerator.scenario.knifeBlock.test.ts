// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { knifeBlock } from './scenarios/knifeBlock';

runScenarios(knifeBlock);
