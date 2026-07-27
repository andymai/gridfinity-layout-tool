// @vitest-environment node
import { runExportIntegrity } from './__kernel-tests__/exportIntegrityRunner';
import { honeycombJunction } from './scenarios/honeycombJunction';

runExportIntegrity(honeycombJunction);
