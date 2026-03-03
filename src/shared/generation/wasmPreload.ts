/**
 * Primes the HTTP cache with the OpenCascade WASM binary during idle time.
 *
 * Uses a background fetch() instead of <link rel="preload"> because the WASM
 * is consumed by a Web Worker, not the document. Preload hints track usage at
 * the document level and emit "not used within a few seconds" warnings when
 * the resource is only consumed cross-context (by a worker). A plain fetch
 * with the same credentials mode Emscripten uses ensures the HTTP cache entry
 * is reusable by the worker without warnings or CORS-mode mismatches.
 */

import singleWasm from 'brepjs-opencascade/src/brepjs_single.wasm?url';
import threadedWasm from 'brepjs-opencascade/src/brepjs_threaded.wasm?url';
import { detectWasmCapabilities } from '@/shared/generation/wasmCapabilities';

let preloaded = false;

export function preloadWasmBinary(): void {
  if (preloaded) return;

  try {
    const url = detectWasmCapabilities().supportsThreads ? threadedWasm : singleWasm;

    // Fire-and-forget fetch that mirrors Emscripten's credentials mode.
    // The response is discarded — we only care about priming the HTTP cache.
    void fetch(url, { credentials: 'same-origin' }).catch(() => {
      // Network failure is non-fatal; the worker will attempt its own fetch.
      preloaded = false;
    });

    preloaded = true;
  } catch {
    // Leave preloaded false so a later call can retry
  }
}
