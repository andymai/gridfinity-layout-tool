// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { wallCutoutPaths } from './scenarios/wallCutoutPaths';

runExportIntegrity(wallCutoutPaths);
