import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all heavy dependencies before importing the module under test
vi.mock('brepjs', () => ({
  initFromOC: vi.fn(),
}));

// Minimal valid WASM binary (empty module)
const MINIMAL_WASM = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

// Create a real WebAssembly.Module for testing
let testModule: WebAssembly.Module;

// Mock Emscripten single-threaded factory
const mockSingleInit = vi.fn();
vi.mock('brepjs-opencascade/src/brepjs_single.js', () => ({
  default: (...args: unknown[]) => mockSingleInit(...args),
}));
vi.mock('brepjs-opencascade/src/brepjs_single.wasm?url', () => ({
  default: '/assets/brepjs_single-abc123.wasm',
}));

// Mock Emscripten threaded factory (not used in dev mode)
vi.mock('brepjs-opencascade/src/brepjs_threaded.js', () => ({
  default: vi.fn(),
}));
vi.mock('brepjs-opencascade/src/brepjs_threaded.wasm?url', () => ({
  default: '/assets/brepjs_threaded-def456.wasm',
}));
vi.mock('brepjs-opencascade/src/brepjs_threaded.worker.js?url', () => ({
  default: '/assets/brepjs_threaded.worker.js',
}));
vi.mock('brepjs-opencascade/src/brepjs_threaded.js?url', () => ({
  default: '/assets/brepjs_threaded.js',
}));

// Mock wasmCapabilities (always single-threaded in tests/dev)
vi.mock('@/shared/generation/wasmCapabilities', () => ({
  detectWasmCapabilities: () => ({ supportsThreads: false }),
}));

// Mock the cache module
const mockGetCachedModule = vi.fn();
const mockCacheModule = vi.fn();
vi.mock('./wasmModuleCache', () => ({
  getCachedModule: (...args: unknown[]) => mockGetCachedModule(...args),
  cacheModule: (...args: unknown[]) => mockCacheModule(...args),
}));

beforeEach(async () => {
  vi.clearAllMocks();
  testModule = await WebAssembly.compile(MINIMAL_WASM);

  // Default: Emscripten factory calls instantiateWasm and resolves
  mockSingleInit.mockImplementation(async (config: Record<string, unknown>) => {
    // If instantiateWasm is provided, call it to simulate Emscripten behavior
    if (typeof config.instantiateWasm === 'function') {
      const instantiateWasm = config.instantiateWasm as (
        imports: WebAssembly.Imports,
        receiveInstance: (instance: WebAssembly.Instance) => void
      ) => Record<string, unknown>;
      await new Promise<void>((resolve) => {
        instantiateWasm({}, (_instance) => {
          resolve();
        });
      });
    }
    return { ready: true };
  });
  mockGetCachedModule.mockResolvedValue(null);
  mockCacheModule.mockResolvedValue(undefined);
});

describe('wasmInstantiator', () => {
  it('uses provided cachedModule and skips IDB lookup', async () => {
    const { loadOpenCascade } = await import('./wasmInstantiator');

    const result = await loadOpenCascade({ cachedModule: testModule });

    expect(mockGetCachedModule).not.toHaveBeenCalled();
    expect(result.wasmModule).toBe(testModule);
    expect(result.isThreaded).toBe(false);
    expect(result.hardwareConcurrency).toBeGreaterThan(0);
  });

  it('uses IDB-cached module when available', async () => {
    mockGetCachedModule.mockResolvedValue(testModule);

    const { loadOpenCascade } = await import('./wasmInstantiator');
    const result = await loadOpenCascade();

    expect(mockGetCachedModule).toHaveBeenCalledWith('/assets/brepjs_single-abc123.wasm');
    expect(result.wasmModule).toBe(testModule);
    // Should not cache again (already in IDB)
    expect(mockCacheModule).not.toHaveBeenCalled();
  });

  it('compiles from network on cache miss and caches result', async () => {
    mockGetCachedModule.mockResolvedValue(null);

    // Mock fetch + compileStreaming to avoid real network requests
    const originalFetch = globalThis.fetch;
    const originalCompileStreaming = WebAssembly.compileStreaming;
    const mockResponse = new Response(MINIMAL_WASM);
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);
    WebAssembly.compileStreaming = vi.fn().mockResolvedValue(testModule);

    try {
      const { loadOpenCascade } = await import('./wasmInstantiator');
      const result = await loadOpenCascade();

      expect(result.wasmModule).toBe(testModule);
      expect(mockCacheModule).toHaveBeenCalledWith('/assets/brepjs_single-abc123.wasm', testModule);
    } finally {
      globalThis.fetch = originalFetch;
      WebAssembly.compileStreaming = originalCompileStreaming;
    }
  });

  it('calls initFromOC with factory result', async () => {
    const { initFromOC } = await import('brepjs');
    const { loadOpenCascade } = await import('./wasmInstantiator');

    await loadOpenCascade({ cachedModule: testModule });

    expect(initFromOC).toHaveBeenCalledWith({ ready: true });
  });

  it('passes instantiateWasm override to Emscripten factory', async () => {
    const { loadOpenCascade } = await import('./wasmInstantiator');

    await loadOpenCascade({ cachedModule: testModule });

    expect(mockSingleInit).toHaveBeenCalledTimes(1);
    const config = mockSingleInit.mock.calls[0][0] as Record<string, unknown>;
    expect(config).toHaveProperty('instantiateWasm');
    expect(config).toHaveProperty('locateFile');
  });
});
