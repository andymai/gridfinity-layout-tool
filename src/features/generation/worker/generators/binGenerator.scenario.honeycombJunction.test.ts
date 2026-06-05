// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { honeycombJunction } from './scenarios/honeycombJunction';

runScenarios(honeycombJunction);
