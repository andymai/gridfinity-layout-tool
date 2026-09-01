// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import {
  scoop,
  scoopTwoVariable,
  scoopSides,
  scoopFlatBase,
  scoopLipInteraction,
  scoopMultiCompartment,
} from './scenarios/scoops';

runScenarios([
  ...scoop,
  ...scoopTwoVariable,
  ...scoopSides,
  ...scoopFlatBase,
  ...scoopLipInteraction,
  ...scoopMultiCompartment,
]);
