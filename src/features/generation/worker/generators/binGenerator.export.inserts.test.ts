// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { inserts, multipleInserts } from './scenarios/inserts';

runExportIntegrity([...inserts, ...multipleInserts]);
