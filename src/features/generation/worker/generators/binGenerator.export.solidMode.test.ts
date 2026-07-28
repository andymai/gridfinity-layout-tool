// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { solidMode } from './scenarios/solidMode';

runExportIntegrity(solidMode);
