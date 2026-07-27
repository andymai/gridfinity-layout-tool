// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { slottedVariations } from './scenarios/slotted';

runExportIntegrity(slottedVariations);
