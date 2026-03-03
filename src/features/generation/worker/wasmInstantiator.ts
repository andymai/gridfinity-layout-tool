/**
 * Orchestrates WASM loading for OpenCascade.
 *
 * Selects threaded vs single-threaded WASM based on browser capabilities
 * and initialises the brepjs kernel.
 *
 * The Emscripten-generated JS uses environment detection (window, importScripts)
 * to locate the .wasm file. In Vite's ES module workers, neither exists, so the
 * WASM path resolves incorrectly. We provide an explicit locateFile override using
 * Vite's ?url imports to ensure the correct path in all environments.
 */

import { initFromOC } from 'brepjs';
import { detectWasmCapabilities } from '@/shared/generation/wasmCapabilities';

// Single-threaded WASM (always available)
import opencascadeSingleInit from 'brepjs-opencascade/src/brepjs_single.js';

// Multi-threaded WASM (conditionally loaded)
import opencascadeThreadedInit from 'brepjs-opencascade/src/brepjs_threaded.js';

// Resolved asset URLs (Vite handles path resolution via ?url imports)
import singleWasmUrl from 'brepjs-opencascade/src/brepjs_single.wasm?url';
import threadedWasmUrl from 'brepjs-opencascade/src/brepjs_threaded.wasm?url';
import threadedWorkerUrl from 'brepjs-opencascade/src/brepjs_threaded.worker.js?url';

export interface WasmLoadResult {
  /** Whether multi-threaded WASM is being used */
  readonly isThreaded: boolean;
  /** Number of CPU cores available */
  readonly hardwareConcurrency: number;
}

/**
 * Detect if multi-threaded WASM is supported in this worker context.
 * Disabled in development mode due to Vite dev server limitations with pthread workers.
 */
function detectThreadingSupport(): boolean {
  if (import.meta.env.DEV) {
    return false;
  }
  return detectWasmCapabilities().supportsThreads;
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
 * Load and initialize OpenCascade.
 *
 * Selects threaded or single-threaded WASM based on browser capabilities
 * and initialises the brepjs kernel with the loaded OpenCascade instance.
 */
export async function loadOpenCascade(): Promise<WasmLoadResult> {
  const isThreaded = detectThreadingSupport();
  const hardwareConcurrency = getHardwareConcurrency();

  // Pass locateFile to override Emscripten's broken path resolution in ES module workers.
  // The init functions are typed as () => Promise but the underlying Emscripten factory
  // still accepts a Module config object.
  const wasmUrl = isThreaded ? threadedWasmUrl : singleWasmUrl;
  const moduleConfig = {
    locateFile: (path: string) => {
      if (path.endsWith('.wasm')) return wasmUrl;
      if (path.endsWith('.worker.js')) return threadedWorkerUrl;
      return path;
    },
  };

  const initFn = isThreaded ? opencascadeThreadedInit : opencascadeSingleInit;
  const OC = await (initFn as (config: typeof moduleConfig) => Promise<unknown>)(moduleConfig);

  initFromOC(OC);

  return { isThreaded, hardwareConcurrency };
}
