// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { interiorFilletScoops } from './scenarios/interiorFillet';

runExportIntegrity(interiorFilletScoops);
