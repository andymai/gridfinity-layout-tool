import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all heavy dependencies before importing the module under test
vi.mock('brepjs', () => ({
  initFromOC: vi.fn(),
  registerKernel: vi.fn(),
  BrepkitAdapter: vi.fn(),
}));

// Mock Emscripten single-threaded factory
const mockSingleInit = vi.fn();
vi.mock('brepjs-opencascade/src/brepjs_single.js', () => ({
  default: (...args: unknown[]) => mockSingleInit(...args),
}));

// Mock WASM URL import
vi.mock('brepjs-opencascade/src/brepjs_single.wasm?url', () => ({
  default: '/mocked/brepjs_single.wasm',
}));
vi.mock('brepkit-wasm', () => ({
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class -- Mock class for BrepKernel constructor
  BrepKernel: class MockBrepKernel {},
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  mockSingleInit.mockResolvedValue({ ready: true });
});

describe('wasmInstantiator', () => {
  it('uses single-threaded init with locateFile override', async () => {
    const { loadOpenCascade } = await import('./wasmInstantiator');

    const result = await loadOpenCascade();

    expect(mockSingleInit).toHaveBeenCalledTimes(1);
    expect(mockSingleInit).toHaveBeenCalledWith(
      expect.objectContaining({
        locateFile: expect.any(Function),
      })
    );

    const { locateFile } = mockSingleInit.mock.calls[0][0] as {
      locateFile: (p: string) => string;
    };
    expect(locateFile('brepjs_single.wasm')).toBe('/mocked/brepjs_single.wasm');
    expect(locateFile('other.js')).toBe('other.js');

    expect(result.isThreaded).toBe(false);
    expect(result.hardwareConcurrency).toBeGreaterThan(0);
  });

  it('calls initFromOC with factory result', async () => {
    const { initFromOC } = await import('brepjs');
    const { loadOpenCascade } = await import('./wasmInstantiator');

    await loadOpenCascade();

    expect(initFromOC).toHaveBeenCalledWith({ ready: true });
  });

  it('returns hardwareConcurrency from navigator', async () => {
    const { loadOpenCascade } = await import('./wasmInstantiator');

    const result = await loadOpenCascade();

    expect(result.hardwareConcurrency).toBeGreaterThan(0);
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
