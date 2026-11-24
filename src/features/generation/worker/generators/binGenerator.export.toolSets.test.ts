// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { toolSets } from './scenarios/toolSets';

runExportIntegrity(toolSets);
