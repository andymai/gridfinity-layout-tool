/**
 * Orchestrates WASM loading for OpenCascade.
 *
 * Selects threaded vs single-threaded WASM based on browser capabilities
 * and initialises the brepjs kernel.
 */

import { initFromOC } from 'brepjs';
import { detectWasmCapabilities } from '@/shared/generation/wasmCapabilities';

// Single-threaded WASM (always available)
import opencascadeSingleInit from 'brepjs-opencascade/src/brepjs_single.js';

// Multi-threaded WASM (conditionally loaded)
import opencascadeThreadedInit from 'brepjs-opencascade/src/brepjs_threaded.js';

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

  const OC = isThreaded ? await opencascadeThreadedInit() : await opencascadeSingleInit();

  initFromOC(OC);

  return { isThreaded, hardwareConcurrency };
}
