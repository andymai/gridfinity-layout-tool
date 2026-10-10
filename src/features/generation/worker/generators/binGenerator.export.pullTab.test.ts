// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { pullTab } from './scenarios/pullTab';

runExportIntegrity(pullTab);
