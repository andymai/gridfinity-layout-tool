// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { exportMode, largeBin, asymmetric } from './scenarios/exportAndLarge';

runExportIntegrity([...exportMode, ...largeBin, ...asymmetric]);
