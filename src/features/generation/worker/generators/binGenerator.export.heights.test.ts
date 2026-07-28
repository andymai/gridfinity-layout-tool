// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { heightVariations } from './scenarios/heights';

runExportIntegrity(heightVariations);
