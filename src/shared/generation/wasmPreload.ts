/**
 * Preloads the OpenCascade WASM binary during idle time.
 *
 * Injects a `<link rel="preload">` tag so the browser fetches the binary
 * before any worker requests it, eliminating the network waterfall when
 * the user navigates to the bin designer or baseplate generator.
 */

import singleWasm from 'brepjs-opencascade/src/brepjs_single.wasm?url';
import threadedWasm from 'brepjs-opencascade/src/brepjs_threaded.wasm?url';
import { detectWasmCapabilities } from '@/features/generation/utils/wasmCapabilities';

let preloaded = false;

export function preloadWasmBinary(): void {
  if (preloaded) return;
  if (typeof document === 'undefined' || !document.head) return;

  try {
    const url = detectWasmCapabilities().supportsThreads ? threadedWasm : singleWasm;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'fetch';
    link.crossOrigin = 'anonymous';
    link.href = url;
    document.head.appendChild(link);

    preloaded = true;
  } catch {
    // Leave preloaded false so a later call can retry
  }
}
