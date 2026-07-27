// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { wallPatterns } from './scenarios/wallPatterns';

runExportIntegrity(wallPatterns);
