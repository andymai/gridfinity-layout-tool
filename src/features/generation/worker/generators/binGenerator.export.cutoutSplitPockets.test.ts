// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { cutoutSplitPockets } from './scenarios/cutoutSplitPockets';

runExportIntegrity(cutoutSplitPockets);
