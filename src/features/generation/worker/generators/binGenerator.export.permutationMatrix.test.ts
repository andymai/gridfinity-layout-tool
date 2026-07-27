// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { permutationMatrix } from './scenarios/permutationMatrix';

runExportIntegrity(permutationMatrix);
