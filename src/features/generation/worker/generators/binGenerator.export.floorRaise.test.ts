// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { floorRaise } from './scenarios/floorRaise';

runExportIntegrity(floorRaise);
