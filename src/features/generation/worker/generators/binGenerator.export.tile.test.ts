// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { tile } from './scenarios/tile';

runExportIntegrity(tile);
