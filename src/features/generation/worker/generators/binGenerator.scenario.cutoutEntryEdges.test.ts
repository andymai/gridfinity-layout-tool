// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { cutoutEntryEdges } from './scenarios/cutoutEntryEdges';

runScenarios(cutoutEntryEdges);
