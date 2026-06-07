import { describe, it, expect } from 'vitest';
import { isStaleAssetError } from './wasmLoadError';

describe('isStaleAssetError', () => {
  it('flags the fetchWasmBinary stale-asset message', () => {
    const err = new Error(
      'OCCT WASM asset returned text/html, not a WebAssembly binary (/assets/occt.wasm). ' +
        'A stale cache or service worker is likely serving a missing asset — hard-reload the page.'
    );
    expect(isStaleAssetError(err)).toBe(true);
  });

  it('flags the worker bootstrap script-load failure', () => {
    const err = new Error(
      'Worker failed to initialize: script failed to load (possible network error, CSP restriction, or unsupported browser)'
    );
    expect(isStaleAssetError(err)).toBe(true);
  });

  it('flags the raw Emscripten CompileError magic-byte message', () => {
    expect(isStaleAssetError(new Error("CompileError: ... doesn't start with '\\0asm'"))).toBe(
      true
    );
  });

  it('flags a failed dynamic chunk import', () => {
    expect(
      isStaleAssetError(new Error('Failed to fetch dynamically imported module: /assets/occt-x.js'))
    ).toBe(true);
  });

  it('flags the relaxed-SIMD compile failure from a stale cached bundle', () => {
    expect(
      isStaleAssetError(
        new Error(
          "Kernel init failed: Aborted(CompileError: WebAssembly.Module doesn't parse at byte 301: " +
            'relaxed simd instructions not supported, in function at index 219).'
        )
      )
    ).toBe(true);
  });

  it('does not flag unrelated generation errors', () => {
    expect(isStaleAssetError(new Error('Split export range failed: STL_EXPORT_FAILED'))).toBe(
      false
    );
  });

  it('handles non-Error values without throwing', () => {
    expect(isStaleAssetError('script failed to load')).toBe(true);
    expect(isStaleAssetError(undefined)).toBe(false);
  });
});
