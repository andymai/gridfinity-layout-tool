// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { solidCutouts } from './scenarios/solidCutouts';

runExportIntegrity(solidCutouts);
