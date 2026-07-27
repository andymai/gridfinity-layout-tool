// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { halfSockets } from './scenarios/halfSockets';

runExportIntegrity(halfSockets);
