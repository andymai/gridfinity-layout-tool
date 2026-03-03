/**
 * Orchestrates WASM loading for OpenCascade.
 *
 * Always uses single-threaded WASM. Multi-threaded (pthread) WASM is
 * incompatible with Vite's bundling: Emscripten pthreads expect the main JS
 * module to exist as a standalone importable file, but Vite/Rollup inlines it
 * into the worker chunk. The pthread sub-workers then fail with
 * "Failed to fetch dynamically imported module" because the original filename
 * (brepjs_threaded.js) no longer exists in the build output.
 *
 * The Emscripten-generated JS uses environment detection (window, importScripts)
 * to locate the .wasm file. In Vite's ES module workers, neither exists, so the
 * WASM path resolves incorrectly. We provide an explicit locateFile override using
 * Vite's ?url imports to ensure the correct path in all environments.
 */

import { initFromOC } from 'brepjs';

// Single-threaded WASM (always used — see module doc for why threaded is disabled)
import opencascadeSingleInit from 'brepjs-opencascade/src/brepjs_single.js';

// Resolved WASM binary URL (Vite handles asset path resolution)
import singleWasmUrl from 'brepjs-opencascade/src/brepjs_single.wasm?url';

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
 * Load and initialize OpenCascade (single-threaded).
 *
 * Initialises the brepjs kernel with the loaded OpenCascade instance.
 */
export async function loadOpenCascade(): Promise<WasmLoadResult> {
  const hardwareConcurrency = getHardwareConcurrency();

  // Pass locateFile to override Emscripten's broken path resolution in ES module workers.
  // The init function is typed as () => Promise but the underlying Emscripten factory
  // still accepts a Module config object.
  const moduleConfig = {
    locateFile: (path: string) => (path.endsWith('.wasm') ? singleWasmUrl : path),
  };

  const OC = await (opencascadeSingleInit as (config: typeof moduleConfig) => Promise<unknown>)(
    moduleConfig
  );

  initFromOC(OC);

  return { isThreaded: false, hardwareConcurrency };
}
