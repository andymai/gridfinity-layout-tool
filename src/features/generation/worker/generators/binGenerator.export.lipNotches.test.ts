// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { lipNotches } from './scenarios/lipNotches';

runExportIntegrity(lipNotches);
