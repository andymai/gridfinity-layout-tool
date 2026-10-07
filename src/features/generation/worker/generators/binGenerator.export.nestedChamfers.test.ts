// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { nestedChamfers } from './scenarios/nestedChamfers';

runExportIntegrity(nestedChamfers);
