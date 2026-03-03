import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock WASM URL imports — Vite ?url imports resolve to strings at build time
vi.mock('brepjs-opencascade/src/brepjs_single.wasm?url', () => ({
  default: '/mock-single.wasm',
}));

vi.mock('brepjs-opencascade/src/brepjs_threaded.wasm?url', () => ({
  default: '/mock-threaded.wasm',
}));

vi.mock('@/shared/generation/wasmCapabilities', () => ({
  detectWasmCapabilities: vi.fn(() => ({
    supportsThreads: true,
    hardwareConcurrency: 4,
    crossOriginIsolated: true,
  })),
}));

import { detectWasmCapabilities } from '@/shared/generation/wasmCapabilities';
const mockDetectWasmCapabilities = vi.mocked(detectWasmCapabilities);

// Capture fetch calls made by preloadWasmBinary
const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());

describe('preloadWasmBinary', () => {
  beforeEach(() => {
    // Reset module registry so `preloaded` flag starts as false each test
    vi.resetModules();
    fetchSpy.mockClear();
    // Clear call history and reset to threaded default; individual tests override as needed
    mockDetectWasmCapabilities.mockClear();
    mockDetectWasmCapabilities.mockReturnValue({
      supportsThreads: true,
      hardwareConcurrency: 4,
      crossOriginIsolated: true,
    });
  });

  it('calls fetch() with the WASM URL and same-origin credentials', async () => {
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

  it('uses threaded WASM URL when supportsThreads is true', async () => {
    mockDetectWasmCapabilities.mockReturnValue({
      supportsThreads: true,
      hardwareConcurrency: 8,
      crossOriginIsolated: true,
    });

    const { preloadWasmBinary } = await import('./wasmPreload');
    preloadWasmBinary();

    expect(fetchSpy).toHaveBeenCalledWith('/mock-threaded.wasm', { credentials: 'same-origin' });
  });

  it('uses single WASM URL when supportsThreads is false', async () => {
    mockDetectWasmCapabilities.mockReturnValue({
      supportsThreads: false,
      hardwareConcurrency: 4,
      crossOriginIsolated: false,
    });

    const { preloadWasmBinary } = await import('./wasmPreload');
    preloadWasmBinary();

    expect(fetchSpy).toHaveBeenCalledWith('/mock-single.wasm', { credentials: 'same-origin' });
  });

  it('is idempotent — second call does not fetch again', async () => {
    const { preloadWasmBinary } = await import('./wasmPreload');

    preloadWasmBinary();
    preloadWasmBinary();

    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('is idempotent — second call does not call detectWasmCapabilities again', async () => {
    const { preloadWasmBinary } = await import('./wasmPreload');

    preloadWasmBinary();
    preloadWasmBinary();

    expect(mockDetectWasmCapabilities).toHaveBeenCalledTimes(1);
  });

  it('retries on next call if detectWasmCapabilities throws', async () => {
    mockDetectWasmCapabilities.mockImplementationOnce(() => {
      throw new Error('detection failed');
    });

    const { preloadWasmBinary } = await import('./wasmPreload');

    // First call fails — no fetch
    preloadWasmBinary();
    expect(fetchSpy).not.toHaveBeenCalled();

    // Second call succeeds — fetch issued
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
