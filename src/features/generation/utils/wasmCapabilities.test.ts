import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test in isolation since the module caches results
describe('wasmCapabilities', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('detectWasmCapabilities', () => {
    it('detects full threading support when cross-origin isolated', async () => {
      vi.stubGlobal('crossOriginIsolated', true);
      vi.stubGlobal('SharedArrayBuffer', function SharedArrayBuffer() {});
      vi.stubGlobal('Atomics', {});
      vi.stubGlobal('navigator', { hardwareConcurrency: 8 });

      const { detectWasmCapabilities } = await import('./wasmCapabilities');
      const caps = detectWasmCapabilities();

      expect(caps.supportsThreads).toBe(true);
      expect(caps.crossOriginIsolated).toBe(true);
      expect(caps.hardwareConcurrency).toBe(8);
    });

    it('returns false when not cross-origin isolated', async () => {
      vi.stubGlobal('crossOriginIsolated', false);
      vi.stubGlobal('SharedArrayBuffer', function SharedArrayBuffer() {});
      vi.stubGlobal('Atomics', {});
      vi.stubGlobal('navigator', { hardwareConcurrency: 4 });

      const { detectWasmCapabilities } = await import('./wasmCapabilities');
      const caps = detectWasmCapabilities();

      expect(caps.supportsThreads).toBe(false);
      expect(caps.crossOriginIsolated).toBe(false);
    });

    it('returns false when Atomics unavailable', async () => {
      vi.stubGlobal('crossOriginIsolated', true);
      vi.stubGlobal('SharedArrayBuffer', function SharedArrayBuffer() {});
      // Atomics not defined - delete it
      const originalAtomics = globalThis.Atomics;
      // @ts-expect-error - intentionally deleting for test
      delete globalThis.Atomics;
      vi.stubGlobal('navigator', { hardwareConcurrency: 4 });

      const { detectWasmCapabilities } = await import('./wasmCapabilities');
      const caps = detectWasmCapabilities();

      // Restore Atomics
      globalThis.Atomics = originalAtomics;

      expect(caps.supportsThreads).toBe(false);
    });

    it('returns false when SharedArrayBuffer unavailable despite cross-origin isolation', async () => {
      vi.stubGlobal('crossOriginIsolated', true);
      // SharedArrayBuffer not defined - delete it
      const originalSAB = globalThis.SharedArrayBuffer;
      // @ts-expect-error - intentionally deleting for test
      delete globalThis.SharedArrayBuffer;
      vi.stubGlobal('Atomics', {});
      vi.stubGlobal('navigator', { hardwareConcurrency: 4 });

      const { detectWasmCapabilities } = await import('./wasmCapabilities');
      const caps = detectWasmCapabilities();

      // Restore SharedArrayBuffer
      globalThis.SharedArrayBuffer = originalSAB;

      expect(caps.supportsThreads).toBe(false);
      expect(caps.crossOriginIsolated).toBe(true);
    });

    it('defaults hardwareConcurrency to 4 when unavailable', async () => {
      vi.stubGlobal('crossOriginIsolated', false);
      vi.stubGlobal('navigator', {});

      const { detectWasmCapabilities } = await import('./wasmCapabilities');
      const caps = detectWasmCapabilities();

      expect(caps.hardwareConcurrency).toBe(4);
    });

    it('caches results on subsequent calls', async () => {
      vi.stubGlobal('crossOriginIsolated', true);
      vi.stubGlobal('SharedArrayBuffer', function SharedArrayBuffer() {});
      vi.stubGlobal('Atomics', {});
      vi.stubGlobal('navigator', { hardwareConcurrency: 8 });

      const { detectWasmCapabilities } = await import('./wasmCapabilities');
      const caps1 = detectWasmCapabilities();
      const caps2 = detectWasmCapabilities();

      expect(caps1).toBe(caps2); // Same reference
    });
  });

  describe('canUseThreadedWasm', () => {
    it('returns true when threading is supported', async () => {
      vi.stubGlobal('crossOriginIsolated', true);
      vi.stubGlobal('SharedArrayBuffer', function SharedArrayBuffer() {});
      vi.stubGlobal('Atomics', {});
      vi.stubGlobal('navigator', { hardwareConcurrency: 4 });

      const { canUseThreadedWasm } = await import('./wasmCapabilities');
      expect(canUseThreadedWasm()).toBe(true);
    });

    it('returns false when threading is not supported', async () => {
      vi.stubGlobal('crossOriginIsolated', false);
      vi.stubGlobal('navigator', { hardwareConcurrency: 4 });

      const { canUseThreadedWasm } = await import('./wasmCapabilities');
      expect(canUseThreadedWasm()).toBe(false);
    });
  });
});
