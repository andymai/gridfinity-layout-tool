// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { baseStyles } from './scenarios/baseStyles';

runExportIntegrity(baseStyles);
