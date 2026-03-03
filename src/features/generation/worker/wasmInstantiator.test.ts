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

// Mock Emscripten threaded factory
const mockThreadedInit = vi.fn();
vi.mock('brepjs-opencascade/src/brepjs_threaded.js', () => ({
  default: (...args: unknown[]) => mockThreadedInit(...args),
}));

// Mock WASM/JS/worker URL imports
vi.mock('brepjs-opencascade/src/brepjs_single.wasm?url', () => ({
  default: '/mocked/brepjs_single.wasm',
}));
vi.mock('brepjs-opencascade/src/brepjs_threaded.js?url', () => ({
  default: '/mocked/brepjs_threaded.js',
}));
vi.mock('brepjs-opencascade/src/brepjs_threaded.wasm?url', () => ({
  default: '/mocked/brepjs_threaded.wasm',
}));
vi.mock('brepjs-opencascade/src/brepjs_threaded.worker.js?url', () => ({
  default: '/mocked/brepjs_threaded.worker.js',
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  mockSingleInit.mockResolvedValue({ ready: true });
  mockThreadedInit.mockResolvedValue({ ready: true, threaded: true });
});

describe('wasmInstantiator', () => {
  describe('single-threaded path', () => {
    it('uses single-threaded init with locateFile override', async () => {
      const { loadOpenCascade } = await import('./wasmInstantiator');

      const result = await loadOpenCascade();

      expect(mockSingleInit).toHaveBeenCalledTimes(1);
      expect(mockThreadedInit).not.toHaveBeenCalled();
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

    it('always uses single-threaded (threading disabled for perf)', async () => {
      const { loadOpenCascade } = await import('./wasmInstantiator');
      const result = await loadOpenCascade();

      expect(mockSingleInit).toHaveBeenCalledTimes(1);
      expect(mockThreadedInit).not.toHaveBeenCalled();
      expect(result.isThreaded).toBe(false);
    });
  });

  describe('threaded path (disabled)', () => {
    it('uses single-threaded even in production', async () => {
      vi.stubEnv('DEV', '');

      const { loadOpenCascade } = await import('./wasmInstantiator');
      const result = await loadOpenCascade();

      expect(mockSingleInit).toHaveBeenCalledTimes(1);
      expect(mockThreadedInit).not.toHaveBeenCalled();
      expect(result.isThreaded).toBe(false);

      vi.unstubAllEnvs();
    });
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
});
