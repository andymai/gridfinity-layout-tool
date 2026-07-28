// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { groupedScoop } from './scenarios/groupedScoop';

runExportIntegrity(groupedScoop);
