import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all heavy dependencies before importing the module under test
vi.mock('brepjs', () => ({
  registerKernel: vi.fn(),
  BrepkitAdapter: vi.fn(),
  OcctWasmAdapter: Object.assign(vi.fn(), { fromKernel: vi.fn(() => ({})) }),
  loadFont: vi.fn(),
  initFromManifold: vi.fn(),
  getKernel: vi.fn(() => ({ setQuality: vi.fn() })),
}));

// Mock occt-wasm kernel factory
const mockGetRawModule = vi.fn(() => ({}));
const mockGetRawKernel = vi.fn(() => ({}));
const mockOcctInit = vi.fn(async () => ({
  getRawModule: mockGetRawModule,
  getRawKernel: mockGetRawKernel,
}));
vi.mock('occt-wasm', () => ({
  OcctKernel: { init: (...args: unknown[]) => mockOcctInit(...args) },
}));
vi.mock('occt-wasm/dist/occt-wasm.wasm?url', () => ({
  default: '/mocked/occt-wasm.wasm',
}));

// Mock manifold-3d factory + its WASM url
const mockManifoldSetup = vi.fn();
const mockManifoldModule = vi.fn(async () => ({ setup: mockManifoldSetup }));
vi.mock('manifold-3d', () => ({ default: (...args: unknown[]) => mockManifoldModule(...args) }));
vi.mock('manifold-3d/manifold.wasm?url', () => ({ default: '/mocked/manifold.wasm' }));

vi.mock('brepkit-wasm', () => ({
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class -- Mock class for BrepKernel constructor
  BrepKernel: class MockBrepKernel {},
}));

/** A minimal valid WASM binary: the 4-byte magic `\0asm` + version word. */
function wasmResponse(): Response {
  const bytes = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/wasm' },
    arrayBuffer: async () => bytes.buffer,
  } as unknown as Response;
}

/** An HTML document — what a stale/missing-asset SPA fallback returns for a .wasm URL. */
function htmlResponse(): Response {
  const bytes = new TextEncoder().encode('<!doctype html><html></html>');
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'text/html' },
    arrayBuffer: async () => bytes.buffer,
  } as unknown as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => wasmResponse())
  );
});

describe('wasmInstantiator', () => {
  describe('loadOcctWasm', () => {
    it('initializes occt-wasm and registers it as the kernel', async () => {
      const { registerKernel, OcctWasmAdapter } = await import('brepjs');
      const { loadOcctWasm } = await import('./wasmInstantiator');

      const result = await loadOcctWasm();

      // The loader fetches+validates the binary itself, then hands the bytes
      // (not the URL) to the kernel.
      expect(fetch).toHaveBeenCalledWith('/mocked/occt-wasm.wasm');
      expect(mockOcctInit).toHaveBeenCalledWith({ wasm: expect.any(ArrayBuffer) });
      expect(OcctWasmAdapter.fromKernel).toHaveBeenCalledTimes(1);
      expect(registerKernel).toHaveBeenCalledWith('occt-wasm', expect.anything());
      expect(result.isThreaded).toBe(false);
      expect(result.hardwareConcurrency).toBeGreaterThan(0);
    });

    it('fails with an actionable error when the WASM asset returns HTML', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => htmlResponse())
      );
      const { loadOcctWasm } = await import('./wasmInstantiator');

      await expect(loadOcctWasm()).rejects.toThrow(/not a WebAssembly binary/i);
      // The kernel is never handed the HTML bytes.
      expect(mockOcctInit).not.toHaveBeenCalled();
    });

    it('fails when the WASM asset 404s', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () => ({ ok: false, status: 404, statusText: 'Not Found' }) as unknown as Response
        )
      );
      const { loadOcctWasm } = await import('./wasmInstantiator');

      await expect(loadOcctWasm()).rejects.toThrow(/fetch failed: 404/i);
    });
  });

  describe('loadManifold', () => {
    it('validates the WASM, inits the factory with the binary, and pins draft quality', async () => {
      const { initFromManifold, getKernel } = await import('brepjs');
      const { loadManifold } = await import('./wasmInstantiator');

      const result = await loadManifold();

      expect(fetch).toHaveBeenCalledWith('/mocked/manifold.wasm');
      expect(mockManifoldModule).toHaveBeenCalledWith({ wasmBinary: expect.any(ArrayBuffer) });
      expect(mockManifoldSetup).toHaveBeenCalledTimes(1);
      expect(initFromManifold).toHaveBeenCalledTimes(1);
      expect(getKernel).toHaveBeenCalledWith('manifold');
      expect(result.isThreaded).toBe(false);
      expect(result.hardwareConcurrency).toBeGreaterThan(0);
    });

    it('fails with an actionable error when the WASM asset returns HTML', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => htmlResponse())
      );
      const { loadManifold } = await import('./wasmInstantiator');

      await expect(loadManifold()).rejects.toThrow(/not a WebAssembly binary/i);
      expect(mockManifoldModule).not.toHaveBeenCalled();
    });
  });

  describe('loadBrepkit', () => {
    it('creates BrepKernel, wraps with BrepkitAdapter, and registers kernel', async () => {
      const { registerKernel, BrepkitAdapter } = await import('brepjs');
      const { loadBrepkit } = await import('./wasmInstantiator');

      const result = await loadBrepkit();

      expect(BrepkitAdapter).toHaveBeenCalledTimes(1);
      expect(registerKernel).toHaveBeenCalledWith('brepkit', expect.anything());
      expect(result.isThreaded).toBe(false);
      expect(result.hardwareConcurrency).toBeGreaterThan(0);
    });
  });
});
