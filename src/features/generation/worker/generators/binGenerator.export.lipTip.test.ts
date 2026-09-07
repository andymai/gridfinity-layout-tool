// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { lipTip } from './scenarios/lipTip';

runExportIntegrity(lipTip);
