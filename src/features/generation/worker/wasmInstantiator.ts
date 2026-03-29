/**
 * Orchestrates WASM loading for geometry kernels.
 *
 * Each loader initialises an Emscripten module, wraps it with the appropriate
 * brepjs adapter, and registers it via `registerKernel`. All three follow the
 * same pattern: load WASM → create adapter → register.
 *
 * Vite's ?url imports provide explicit paths because Emscripten's environment
 * detection (window, importScripts) doesn't work in ES module workers.
 */

import { initFromOC, registerKernel, BrepkitAdapter, OcctWasmAdapter } from 'brepjs';
import type { OcctWasmModule } from 'brepjs';

import opencascadeSingleInit from 'brepjs-opencascade/src/brepjs_single.js';
import singleWasmUrl from 'brepjs-opencascade/src/brepjs_single.wasm?url';
import occtWasmInit from 'occt-wasm/dist/occt-wasm.js';
import occtWasmUrl from 'occt-wasm/dist/occt-wasm.wasm?url';

export interface WasmLoadResult {
  /** Whether multi-threaded WASM is being used */
  readonly isThreaded: boolean;
  /** Number of CPU cores available */
  readonly hardwareConcurrency: number;
}

/** Get hardware concurrency with robust validation. */
function getHardwareConcurrency(): number {
  return typeof navigator !== 'undefined' &&
    Number.isFinite(navigator.hardwareConcurrency) &&
    navigator.hardwareConcurrency > 0
    ? navigator.hardwareConcurrency
    : 4;
}

/**
 * Load and initialize the OpenCascade (brepjs-opencascade) geometry kernel.
 */
export async function loadOpenCascade(): Promise<WasmLoadResult> {
  const hardwareConcurrency = getHardwareConcurrency();

  const moduleConfig = {
    locateFile: (path: string) => (path.endsWith('.wasm') ? singleWasmUrl : path),
  };
  const OC = await (opencascadeSingleInit as (config: typeof moduleConfig) => Promise<unknown>)(
    moduleConfig
  );

  initFromOC(OC);

  return { isThreaded: false, hardwareConcurrency };
}

/**
 * Load and initialize the occt-wasm (arena-based OCCT V8) geometry kernel.
 */
export async function loadOcctWasm(): Promise<WasmLoadResult> {
  const hardwareConcurrency = getHardwareConcurrency();

  const moduleConfig = {
    locateFile: (path: string) => (path.endsWith('.wasm') ? occtWasmUrl : path),
  };
  const Module = await (occtWasmInit as (config: typeof moduleConfig) => Promise<unknown>)(
    moduleConfig
  );

  const mod = Module as OcctWasmModule;
  const kernel = new mod.OcctKernel();
  registerKernel('occt-wasm', new OcctWasmAdapter(mod, kernel));

  return { isThreaded: false, hardwareConcurrency };
}

/**
 * Load and initialize the brepkit (Rust-native) geometry kernel.
 */
export async function loadBrepkit(): Promise<WasmLoadResult> {
  const hardwareConcurrency = getHardwareConcurrency();

  const { BrepKernel } = await import('brepkit-wasm');
  const kernel = new BrepKernel();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- KernelInstance is typed as any in brepjs
  registerKernel('brepkit', new BrepkitAdapter(kernel as any));

  return { isThreaded: false, hardwareConcurrency };
}
