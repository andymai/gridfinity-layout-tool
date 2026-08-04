// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { kumikoPatterns } from './scenarios/kumiko';

runExportIntegrity(kumikoPatterns);
