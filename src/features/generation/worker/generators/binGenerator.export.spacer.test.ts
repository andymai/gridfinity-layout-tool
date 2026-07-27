// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { spacer } from './scenarios/spacer';

runExportIntegrity(spacer);
