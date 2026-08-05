// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { trayBottom } from './scenarios/trayBottom';

runExportIntegrity(trayBottom);
