/**
 * WASM capability detection for multi-threading support.
 *
 * Detects whether the browser supports SharedArrayBuffer (required for pthreads)
 * which enables OpenCascade's parallel algorithms for faster geometry generation.
 */

export interface WasmCapabilities {
  /** Whether SharedArrayBuffer is available (cross-origin isolated) */
  readonly supportsThreads: boolean;
  /** Number of logical CPU cores available */
  readonly hardwareConcurrency: number;
  /** Whether the page is cross-origin isolated */
  readonly crossOriginIsolated: boolean;
}

let cachedCapabilities: WasmCapabilities | null = null;

/**
 * Detect WASM threading capabilities.
 * Results are cached after first call.
 */
export function detectWasmCapabilities(): WasmCapabilities {
  if (cachedCapabilities) return cachedCapabilities;

  const crossOriginIsolated =
    typeof self !== 'undefined' && 'crossOriginIsolated' in self && self.crossOriginIsolated;

  const supportsThreads =
    crossOriginIsolated &&
    typeof SharedArrayBuffer !== 'undefined' &&
    typeof Atomics !== 'undefined';

  const hardwareConcurrency =
    typeof navigator !== 'undefined' &&
    Number.isFinite(navigator.hardwareConcurrency) &&
    navigator.hardwareConcurrency > 0
      ? navigator.hardwareConcurrency
      : 4;

  cachedCapabilities = { supportsThreads, hardwareConcurrency, crossOriginIsolated };
  return cachedCapabilities;
}

/**
 * Check if current environment can use multi-threaded WASM.
 * Shorthand for `detectWasmCapabilities().supportsThreads`.
 */
export function canUseThreadedWasm(): boolean {
  return detectWasmCapabilities().supportsThreads;
}
