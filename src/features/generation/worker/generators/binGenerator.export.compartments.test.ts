// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { compartments } from './scenarios/compartments';

runExportIntegrity(compartments);
