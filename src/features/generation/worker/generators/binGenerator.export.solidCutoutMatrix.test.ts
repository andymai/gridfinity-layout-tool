// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { solidCutoutMatrix } from './scenarios/solidCutoutMatrix';

runExportIntegrity(solidCutoutMatrix);
