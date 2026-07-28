// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { handles } from './scenarios/handles';

runExportIntegrity(handles);
