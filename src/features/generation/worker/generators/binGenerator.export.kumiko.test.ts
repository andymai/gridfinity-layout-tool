// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { kumiko } from './scenarios/kumiko';

runExportIntegrity(kumiko);
