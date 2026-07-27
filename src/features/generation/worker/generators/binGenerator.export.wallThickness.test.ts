// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { wallThickness } from './scenarios/wallThickness';

runExportIntegrity(wallThickness);
