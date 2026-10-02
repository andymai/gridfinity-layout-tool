// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { lowProfile } from './scenarios/lowProfile';

runExportIntegrity(lowProfile);
