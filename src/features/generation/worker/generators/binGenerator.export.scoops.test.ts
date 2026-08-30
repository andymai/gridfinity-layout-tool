// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { scoop, scoopTwoVariable, scoopFlatBase, scoopLipInteraction } from './scenarios/scoops';

runExportIntegrity([...scoop, ...scoopTwoVariable, ...scoopFlatBase, ...scoopLipInteraction]);
