// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { variantOverrides } from './scenarios/variantOverrides';

runExportIntegrity(variantOverrides);
