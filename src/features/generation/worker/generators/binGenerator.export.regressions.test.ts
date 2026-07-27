// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { regressions } from './scenarios/regressions';

runExportIntegrity(regressions);
