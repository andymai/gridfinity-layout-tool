// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { exportMode, largeBin, asymmetric } from './scenarios/exportAndLarge';

runScenarios([...exportMode, ...largeBin, ...asymmetric]);
