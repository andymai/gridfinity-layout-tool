import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all heavy dependencies before importing the module under test
vi.mock('brepjs', () => ({
  initFromOC: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks();
  mockSingleInit.mockResolvedValue({ ready: true });
});

describe('wasmInstantiator', () => {
  it('calls single-threaded init with locateFile override', async () => {
    const { loadOpenCascade } = await import('./wasmInstantiator');

    const result = await loadOpenCascade();

    expect(mockSingleInit).toHaveBeenCalledTimes(1);
    expect(mockSingleInit).toHaveBeenCalledWith(
      expect.objectContaining({
        locateFile: expect.any(Function),
      })
    );

    // Verify locateFile returns resolved URL for .wasm paths, passthrough for others
    const { locateFile } = mockSingleInit.mock.calls[0][0] as { locateFile: (p: string) => string };
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

    // In jsdom, navigator.hardwareConcurrency is available
    expect(result.hardwareConcurrency).toBeGreaterThan(0);
  });
});
