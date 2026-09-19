// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { openSides } from './scenarios/openSides';

runExportIntegrity(openSides);
