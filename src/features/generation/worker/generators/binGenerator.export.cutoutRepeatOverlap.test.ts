// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { cutoutRepeatOverlap } from './scenarios/cutoutRepeatOverlap';

runExportIntegrity(cutoutRepeatOverlap);
