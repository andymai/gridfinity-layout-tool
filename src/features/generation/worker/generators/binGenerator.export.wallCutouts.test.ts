// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { wallCutouts } from './scenarios/wallCutouts';

runExportIntegrity(wallCutouts);
