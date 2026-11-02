// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { cutoutIslands } from './scenarios/cutoutIslands';

runExportIntegrity(cutoutIslands);
