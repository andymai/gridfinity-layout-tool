// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock WASM URL imports — Vite ?url imports resolve to strings at build time
vi.mock('brepkit-wasm/brepkit_wasm_bg.wasm?url', () => ({
  default: '/mock-brepkit.wasm',
}));
vi.mock('occt-wasm/dist/occt-wasm.wasm?url', () => ({
  default: '/mock-occt-wasm.wasm',
}));

// Capture fetch calls made by the preloaders
const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());

describe('preloadOcctWasm', () => {
  beforeEach(() => {
    // Reset module registry so the preloaded flag starts as false each test
    vi.resetModules();
    fetchSpy.mockClear();
  });

  it('preloads the occt-wasm binary', async () => {
    const { preloadOcctWasm } = await import('./wasmPreload');
    preloadOcctWasm();

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledWith('/mock-occt-wasm.wasm', { credentials: 'same-origin' });
  });

  it('does not inject any <link rel="preload"> elements', async () => {
    const { preloadOcctWasm } = await import('./wasmPreload');
    preloadOcctWasm();

    const links = document.head.querySelectorAll('link[rel="preload"]');
    expect(links).toHaveLength(0);
  });

  it('is idempotent — second call does not fetch again', async () => {
    const { preloadOcctWasm } = await import('./wasmPreload');

    preloadOcctWasm();
    preloadOcctWasm();

    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('resets the preloaded flag on fetch failure so a later call can retry', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network error'));

    const { preloadOcctWasm } = await import('./wasmPreload');

    preloadOcctWasm();
    // Wait for the rejected promise to settle
    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledOnce();
    });

    // Allow microtask for the .catch() handler to reset the flag
    await new Promise((r) => setTimeout(r, 0));

    // Second call should retry
    preloadOcctWasm();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe('preloadBrepkitWasm', () => {
  beforeEach(() => {
    vi.resetModules();
    fetchSpy.mockClear();
  });

  it('fetches the brepkit WASM binary', async () => {
    const { preloadBrepkitWasm } = await import('./wasmPreload');
    preloadBrepkitWasm();

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledWith('/mock-brepkit.wasm', { credentials: 'same-origin' });
  });

  it('is idempotent — second call does not fetch again', async () => {
    const { preloadBrepkitWasm } = await import('./wasmPreload');

    preloadBrepkitWasm();
    preloadBrepkitWasm();

    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});
