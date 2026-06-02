import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all heavy dependencies before importing the module under test
vi.mock('brepjs', () => ({
  registerKernel: vi.fn(),
  BrepkitAdapter: vi.fn(),
  OcctWasmAdapter: Object.assign(vi.fn(), { fromKernel: vi.fn(() => ({})) }),
  loadFont: vi.fn(),
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

vi.mock('brepkit-wasm', () => ({
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class -- Mock class for BrepKernel constructor
  BrepKernel: class MockBrepKernel {},
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe('wasmInstantiator', () => {
  describe('loadOcctWasm', () => {
    it('initializes occt-wasm and registers it as the kernel', async () => {
      const { registerKernel, OcctWasmAdapter } = await import('brepjs');
      const { loadOcctWasm } = await import('./wasmInstantiator');

      const result = await loadOcctWasm();

      expect(mockOcctInit).toHaveBeenCalledWith({ wasm: '/mocked/occt-wasm.wasm' });
      expect(OcctWasmAdapter.fromKernel).toHaveBeenCalledTimes(1);
      expect(registerKernel).toHaveBeenCalledWith('occt-wasm', expect.anything());
      expect(result.isThreaded).toBe(false);
      expect(result.hardwareConcurrency).toBeGreaterThan(0);
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
