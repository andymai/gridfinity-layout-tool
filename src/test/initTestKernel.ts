/// <reference types="node" />
/**
 * Shared occt-wasm kernel initialization for Node-based generator tests.
 *
 * occt-wasm is the production default geometry kernel. Registering it as the
 * only kernel makes it the brepjs default, so generator code runs on it
 * without any `withKernel` wrapping — mirroring the production worker.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { registerKernel, OcctWasmAdapter } from 'brepjs';
import { OcctKernel } from 'occt-wasm';

/** Initialize occt-wasm and register it as the active brepjs kernel. */
export async function initTestKernel(): Promise<void> {
  const wasmPath = join(process.cwd(), 'node_modules/occt-wasm/dist/occt-wasm.wasm');
  const wasmBinary = readFileSync(wasmPath);
  const kernel = await OcctKernel.init({ wasm: wasmBinary });
  // fromKernel retains the wrapper for the adapter's lifetime; the bare
  // (module, kernel) constructor only borrows the raw kernel, so a GC pass can
  // free it out from under the adapter ("Cannot pass deleted object…").
  registerKernel('occt-wasm', OcctWasmAdapter.fromKernel(kernel));
}
