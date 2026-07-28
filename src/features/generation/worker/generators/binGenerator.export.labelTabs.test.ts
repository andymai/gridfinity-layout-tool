// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { labelTabs } from './scenarios/labelTabs';

runExportIntegrity(labelTabs);
