// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { cutoutLabelSockets } from './scenarios/cutoutLabelSockets';

runExportIntegrity(cutoutLabelSockets);
