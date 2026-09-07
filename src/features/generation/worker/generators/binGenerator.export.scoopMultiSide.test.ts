// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { scoopMultiSide, scoopSidesDeduped } from './scenarios/scoopMultiSide';

runExportIntegrity([...scoopMultiSide, ...scoopSidesDeduped]);
