// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { cutoutFingerAccess } from './scenarios/cutoutFingerAccess';

runExportIntegrity(cutoutFingerAccess);
