// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import {
  scoop,
  scoopTwoVariable,
  scoopSides,
  scoopFlatBase,
  scoopLipInteraction,
  scoopMultiCompartment,
} from './scenarios/scoops';

runExportIntegrity([
  ...scoop,
  ...scoopTwoVariable,
  ...scoopSides,
  ...scoopFlatBase,
  ...scoopLipInteraction,
  ...scoopMultiCompartment,
]);
