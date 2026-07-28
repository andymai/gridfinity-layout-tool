// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { floorPatterns } from './scenarios/floorPatterns';

runExportIntegrity(floorPatterns);
