// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { cutoutDepthModes } from './scenarios/cutoutDepthModes';

runExportIntegrity(cutoutDepthModes);
