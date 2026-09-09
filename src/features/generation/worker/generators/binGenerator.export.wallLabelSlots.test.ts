// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { wallLabelSlots } from './scenarios/wallLabelSlots';

runExportIntegrity(wallLabelSlots);
