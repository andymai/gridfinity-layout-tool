import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock capability detection
const mockDetect = vi.fn();
vi.mock('@/shared/generation/wasmCapabilities', () => ({
  detectWasmCapabilities: () => mockDetect(),
}));

// Mock WASM URL imports — Vite ?url imports resolve to strings at build time
vi.mock('brepjs-opencascade/src/brepjs_single.wasm?url', () => ({
  default: '/mock-single.wasm',
}));
vi.mock('brepjs-opencascade/src/brepjs_threaded.wasm?url', () => ({
  default: '/mock-threaded.wasm',
}));

// Capture fetch calls made by preloadWasmBinary
const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());

describe('preloadWasmBinary', () => {
  beforeEach(() => {
    // Reset module registry so `preloaded` flag starts as false each test
    vi.resetModules();
    fetchSpy.mockClear();
    // Default: no threading support
    mockDetect.mockReturnValue({
      supportsThreads: false,
      hardwareConcurrency: 4,
      crossOriginIsolated: false,
    });
  });

  it('preloads single-threaded WASM when threads are not supported', async () => {
    const { preloadWasmBinary } = await import('./wasmPreload');
    preloadWasmBinary();

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledWith('/mock-single.wasm', { credentials: 'same-origin' });
  });

  it('preloads threaded WASM when threads are supported', async () => {
    mockDetect.mockReturnValue({
      supportsThreads: true,
      hardwareConcurrency: 8,
      crossOriginIsolated: true,
    });

    const { preloadWasmBinary } = await import('./wasmPreload');
    preloadWasmBinary();

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledWith('/mock-threaded.wasm', { credentials: 'same-origin' });
  });

  it('does not inject any <link rel="preload"> elements', async () => {
    const { preloadWasmBinary } = await import('./wasmPreload');
    preloadWasmBinary();

    const links = document.head.querySelectorAll('link[rel="preload"]');
    expect(links).toHaveLength(0);
  });

  it('is idempotent — second call does not fetch again', async () => {
    const { preloadWasmBinary } = await import('./wasmPreload');

    preloadWasmBinary();
    preloadWasmBinary();

    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('resets preloaded flag on fetch failure so a later call can retry', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network error'));

    const { preloadWasmBinary } = await import('./wasmPreload');

    preloadWasmBinary();
    // Wait for the rejected promise to settle
    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledOnce();
    });

    // Allow microtask for the .catch() handler to reset preloaded
    await new Promise((r) => setTimeout(r, 0));

    // Second call should retry
    preloadWasmBinary();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
