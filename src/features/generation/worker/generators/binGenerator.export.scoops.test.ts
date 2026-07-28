// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { scoop, scoopTwoVariable, scoopLipInteraction } from './scenarios/scoops';

runExportIntegrity([...scoop, ...scoopTwoVariable, ...scoopLipInteraction]);
