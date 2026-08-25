import { describe, it, expect } from 'vitest';
import { isStaleAssetError, stableAssetName } from './wasmLoadError';

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

  it.each([
    ['Safari dynamic import', 'Kernel init failed: Importing a module script failed.'],
    [
      'Firefox dynamic import',
      'Kernel init failed: error loading dynamically imported module: https://x/assets/occt-wasm-C7KBdFbv.js',
    ],
    ['Firefox fetch', 'Kernel init failed: NetworkError when attempting to fetch resource.'],
    [
      'Safari fetch',
      'Kernel init failed: Load failed (first attempt: Kernel init failed: Load failed)',
    ],
    ['Chrome fetch', 'Kernel init failed: Failed to fetch'],
    [
      'truncated download',
      'Kernel init failed: Aborted(CompileError: WebAssembly.instantiate(): section (code 10, "Code") extends past end of the module (length 19686494, remaining bytes 17280021) @+74726)',
    ],
  ])('flags the %s failure, which a reload fixes', (_name, message) => {
    expect(isStaleAssetError(new Error(message))).toBe(true);
  });

  it('leaves an unsupported instruction set unflagged, since reloading cannot help', () => {
    // An old browser that cannot compile the instruction is not a stale cache.
    // Reloading it in a loop would be the only outcome of flagging this.
    expect(
      isStaleAssetError(
        new Error(
          'Kernel init failed: Aborted(CompileError: WebAssembly.instantiate(): Compiling function #72 failed: Wasm SIMD unsupported @+86123)'
        )
      )
    ).toBe(false);
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

describe('stableAssetName', () => {
  it('strips a Vite content hash, keeping the name and extension', () => {
    expect(stableAssetName('/assets/occt-wasm-DVSq216o.wasm')).toBe('occt-wasm-[hash].wasm');
  });

  it('strips a hash from a chunk .js name', () => {
    expect(stableAssetName('/assets/index-A1b2C3d4.js')).toBe('index-[hash].js');
  });

  it('drops the directory and query string, keeping the hash-stripped basename', () => {
    expect(stableAssetName('https://example.com/assets/manifold-Zz00Yy11.wasm?v=2')).toBe(
      'manifold-[hash].wasm'
    );
  });

  it('leaves an unhashed name unchanged', () => {
    expect(stableAssetName('/mocked/occt-wasm.wasm')).toBe('occt-wasm.wasm');
  });

  it('collapses distinct per-deploy hashes to the same stable label', () => {
    // The core bug: different hashes must not fingerprint as different issues.
    expect(stableAssetName('/assets/occt-wasm-DgtMD5nS.wasm')).toBe(
      stableAssetName('/assets/occt-wasm-BRiVxOM5.wasm')
    );
  });
});
