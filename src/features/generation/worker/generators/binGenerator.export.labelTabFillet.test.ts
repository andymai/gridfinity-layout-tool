// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { labelTabFillet } from './scenarios/labelTabFillet';

runExportIntegrity(labelTabFillet);
