// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { edgeCases } from './scenarios/edgeCases';

runExportIntegrity(edgeCases);
