// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { cradle } from './scenarios/cradle';

runExportIntegrity(cradle);
