/**
 * Primes the HTTP cache with geometry-kernel WASM binaries during idle time.
 *
 * Uses a background fetch() instead of <link rel="preload"> because the WASM
 * is consumed by a Web Worker, not the document. Preload hints track usage at
 * the document level and emit "not used within a few seconds" warnings when
 * the resource is only consumed cross-context (by a worker). A plain fetch
 * with the same credentials mode Emscripten uses ensures the HTTP cache entry
 * is reusable by the worker without warnings or CORS-mode mismatches.
 */

import brepkitWasm from 'brepkit-wasm/brepkit_wasm_bg.wasm?url';
import occtWasm from 'occt-wasm/dist/occt-wasm.wasm?url';

let brepkitPreloaded = false;
let occtWasmPreloaded = false;

/**
 * Primes the HTTP cache with the brepkit WASM binary during idle time.
 * Same pattern as `preloadOcctWasm()` but for the Rust-native kernel.
 */
export function preloadBrepkitWasm(): void {
  if (brepkitPreloaded) return;

  try {
    void fetch(brepkitWasm, { credentials: 'same-origin' }).catch(() => {
      brepkitPreloaded = false;
    });

    brepkitPreloaded = true;
  } catch {
    // Leave flag false so a later call can retry
  }
}

/**
 * Primes the HTTP cache with the occt-wasm binary during idle time.
 * occt-wasm is the default geometry kernel.
 */
export function preloadOcctWasm(): void {
  if (occtWasmPreloaded) return;

  try {
    void fetch(occtWasm, { credentials: 'same-origin' }).catch(() => {
      occtWasmPreloaded = false;
    });

    occtWasmPreloaded = true;
  } catch {
    // Leave flag false so a later call can retry
  }
}
