// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { cutoutLabelSockets } from './scenarios/cutoutLabelSockets';

runScenarios(cutoutLabelSockets);
