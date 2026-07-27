// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { cutoutOffset } from './scenarios/cutoutOffset';

runExportIntegrity(cutoutOffset);
