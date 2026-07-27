// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { pathfinderOps } from './scenarios/pathfinderOps';

runExportIntegrity(pathfinderOps);
