// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { integration } from './scenarios/integration';

runExportIntegrity(integration);
