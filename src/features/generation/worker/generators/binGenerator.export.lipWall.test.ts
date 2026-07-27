// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { lipWall } from './scenarios/lipWall';

runExportIntegrity(lipWall);
