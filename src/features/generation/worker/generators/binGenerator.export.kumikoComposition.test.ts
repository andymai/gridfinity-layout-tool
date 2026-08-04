// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { kumikoComposition } from './scenarios/kumikoComposition';

runExportIntegrity(kumikoComposition);
