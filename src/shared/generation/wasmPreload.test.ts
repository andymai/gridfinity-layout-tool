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

describe('preloadWasmBinary', () => {
  beforeEach(() => {
    // Reset module registry so `preloaded` flag starts as false each test
    vi.resetModules();
    // Clear any link elements injected by previous tests
    document.head.innerHTML = '';
    // Clear call history and reset to threaded default; individual tests override as needed
    mockDetectWasmCapabilities.mockClear();
    mockDetectWasmCapabilities.mockReturnValue({
      supportsThreads: true,
      hardwareConcurrency: 4,
      crossOriginIsolated: true,
    });
  });

  it('injects a <link rel="preload" as="fetch"> element into document.head', async () => {
    const { preloadWasmBinary } = await import('./wasmPreload');
    preloadWasmBinary();

    const links = document.head.querySelectorAll('link[rel="preload"]');
    expect(links).toHaveLength(1);

    const link = links[0] as HTMLLinkElement;
    expect(link.rel).toBe('preload');
    // jsdom reflects `as` as a property — getAttribute returns null for non-standard attributes
    expect(link.as).toBe('fetch');
  });

  it('sets crossOrigin to "anonymous" on the injected link', async () => {
    const { preloadWasmBinary } = await import('./wasmPreload');
    preloadWasmBinary();

    const link = document.head.querySelector('link[rel="preload"]');
    expect(link).not.toBeNull();
    expect((link as HTMLLinkElement).crossOrigin).toBe('anonymous');
  });

  it('uses threaded WASM URL when supportsThreads is true', async () => {
    mockDetectWasmCapabilities.mockReturnValue({
      supportsThreads: true,
      hardwareConcurrency: 8,
      crossOriginIsolated: true,
    });

    const { preloadWasmBinary } = await import('./wasmPreload');
    preloadWasmBinary();

    const link = document.head.querySelector('link[rel="preload"]');
    expect(link).not.toBeNull();
    expect((link as HTMLLinkElement).href).toContain('mock-threaded.wasm');
  });

  it('uses single WASM URL when supportsThreads is false', async () => {
    mockDetectWasmCapabilities.mockReturnValue({
      supportsThreads: false,
      hardwareConcurrency: 4,
      crossOriginIsolated: false,
    });

    const { preloadWasmBinary } = await import('./wasmPreload');
    preloadWasmBinary();

    const link = document.head.querySelector('link[rel="preload"]');
    expect(link).not.toBeNull();
    expect((link as HTMLLinkElement).href).toContain('mock-single.wasm');
  });

  it('is idempotent — second call does not inject a second link element', async () => {
    const { preloadWasmBinary } = await import('./wasmPreload');

    preloadWasmBinary();
    preloadWasmBinary();

    const links = document.head.querySelectorAll('link[rel="preload"]');
    expect(links).toHaveLength(1);
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

    // First call fails — no link injected
    preloadWasmBinary();
    expect(document.head.querySelectorAll('link[rel="preload"]')).toHaveLength(0);

    // Second call succeeds — link injected
    preloadWasmBinary();
    expect(document.head.querySelectorAll('link[rel="preload"]')).toHaveLength(1);
  });
});
