/**
 * Orchestrates WASM loading for OpenCascade.
 *
 * Uses multi-threaded (pthread) WASM in production when SharedArrayBuffer is
 * available, falling back to single-threaded WASM otherwise.
 *
 * Threading is disabled in dev mode because Vite's dev server does not serve
 * pthread worker scripts correctly.
 *
 * The Emscripten-generated JS uses environment detection (window, importScripts)
 * to locate the .wasm file. In Vite's ES module workers, neither exists, so the
 * WASM path resolves incorrectly. We provide explicit locateFile overrides using
 * Vite's ?url imports to ensure the correct path in all environments.
 *
 * The threaded .js module is imported twice: once as a module (for the factory
 * function) and once as ?url (for the hashed asset URL to pass to pthread
 * sub-workers via mainScriptUrlOrBlob). Vite handles both correctly.
 */

import { initFromOC } from 'brepjs';
import { detectWasmCapabilities } from '@/shared/generation/wasmCapabilities';

// Single-threaded WASM (always available as fallback)
import opencascadeSingleInit from 'brepjs-opencascade/src/brepjs_single.js';
import singleWasmUrl from 'brepjs-opencascade/src/brepjs_single.wasm?url';

// Multi-threaded WASM (used when SharedArrayBuffer is available)
import opencascadeThreadedInit from 'brepjs-opencascade/src/brepjs_threaded.js';
import threadedJsUrl from 'brepjs-opencascade/src/brepjs_threaded.js?url';
import threadedWasmUrl from 'brepjs-opencascade/src/brepjs_threaded.wasm?url';
import threadedWorkerUrl from 'brepjs-opencascade/src/brepjs_threaded.worker.js?url';

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

/** Whether to use threaded WASM: production only + capability check. */
function shouldUseThreaded(): boolean {
  if (import.meta.env.DEV) return false;
  return detectWasmCapabilities().supportsThreads;
}

/**
 * Load and initialize OpenCascade.
 *
 * Selects threaded or single-threaded WASM based on environment capabilities.
 * Initialises the brepjs kernel with the loaded OpenCascade instance.
 */
export async function loadOpenCascade(): Promise<WasmLoadResult> {
  const hardwareConcurrency = getHardwareConcurrency();
  const useThreaded = shouldUseThreaded();

  let OC: unknown;

  if (useThreaded) {
    const moduleConfig = {
      mainScriptUrlOrBlob: threadedJsUrl,
      locateFile: (path: string) => {
        if (path.endsWith('.wasm')) return threadedWasmUrl;
        if (path.endsWith('.worker.js')) return threadedWorkerUrl;
        return path;
      },
    };
    OC = await (opencascadeThreadedInit as (config: typeof moduleConfig) => Promise<unknown>)(
      moduleConfig
    );
  } else {
    const moduleConfig = {
      locateFile: (path: string) => (path.endsWith('.wasm') ? singleWasmUrl : path),
    };
    OC = await (opencascadeSingleInit as (config: typeof moduleConfig) => Promise<unknown>)(
      moduleConfig
    );
  }

  initFromOC(OC);

  return { isThreaded: useThreaded, hardwareConcurrency };
}
