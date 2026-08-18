// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { knifeBlock } from './scenarios/knifeBlock';

runExportIntegrity(knifeBlock);
