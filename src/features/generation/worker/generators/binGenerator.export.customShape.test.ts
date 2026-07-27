// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { customShapes } from './scenarios/customShape';

runExportIntegrity(customShapes);
