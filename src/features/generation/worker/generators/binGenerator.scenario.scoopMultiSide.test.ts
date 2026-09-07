// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { scoopMultiSide, scoopSidesDeduped } from './scenarios/scoopMultiSide';

runScenarios([...scoopMultiSide, ...scoopSidesDeduped]);
