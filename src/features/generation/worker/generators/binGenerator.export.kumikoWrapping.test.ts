// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { kumikoWrapping } from './scenarios/kumikoWrapping';

runExportIntegrity(kumikoWrapping);
