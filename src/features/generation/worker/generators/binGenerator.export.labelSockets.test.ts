// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { labelSockets } from './scenarios/labelSockets';

runExportIntegrity(labelSockets);
