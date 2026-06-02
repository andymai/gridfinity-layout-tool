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

/**
 * Pins live `OcctKernel` wrappers for the test process lifetime. The wrapper
 * frees its raw Embind kernel via a `FinalizationRegistry` when collected, but
 * `OcctWasmAdapter` only borrows the raw kernel — without this pin a GC pass
 * frees the kernel out from under the adapter and the next op throws "Cannot
 * pass deleted object as a pointer of type OcctKernel*". Mirrors the worker's
 * `loadOcctWasm` retention.
 */
const retainedKernels = new Set<unknown>();

/** Initialize occt-wasm and register it as the active brepjs kernel. */
export async function initTestKernel(): Promise<void> {
  const wasmPath = join(process.cwd(), 'node_modules/occt-wasm/dist/occt-wasm.wasm');
  const wasmBinary = readFileSync(wasmPath);
  const kernel = await OcctKernel.init({ wasm: wasmBinary });
  retainedKernels.add(kernel);
  const adapter = new OcctWasmAdapter(
    kernel.getRawModule() as any,

    kernel.getRawKernel() as any
  );
  registerKernel('occt-wasm', adapter);
}
