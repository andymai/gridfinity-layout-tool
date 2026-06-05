// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { inserts, multipleInserts } from './scenarios/inserts';

runScenarios([...inserts, ...multipleInserts]);
