// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { interiorFilletScoops } from './scenarios/interiorFillet';

runScenarios(interiorFilletScoops);
