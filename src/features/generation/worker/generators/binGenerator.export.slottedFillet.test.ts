// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { slottedFillet } from './scenarios/slottedFillet';

runExportIntegrity(slottedFillet);
