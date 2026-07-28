// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { dividerPatterns } from './scenarios/dividerPatterns';

runExportIntegrity(dividerPatterns);
