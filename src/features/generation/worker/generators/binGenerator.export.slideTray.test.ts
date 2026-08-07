// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { slideTray } from './scenarios/slideTray';

runExportIntegrity(slideTray);
