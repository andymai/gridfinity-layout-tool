// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { cutoutEntryEdges } from './scenarios/cutoutEntryEdges';

runExportIntegrity(cutoutEntryEdges);
