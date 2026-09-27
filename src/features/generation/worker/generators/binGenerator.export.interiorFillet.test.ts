// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { interiorFillet } from './scenarios/interiorFillet';

runExportIntegrity(interiorFillet);
