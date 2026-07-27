// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { lightweight } from './scenarios/lightweight';

runExportIntegrity(lightweight);
