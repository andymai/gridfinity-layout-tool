// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { combinedFeatures } from './scenarios/combinedFeatures';

runExportIntegrity(combinedFeatures);
