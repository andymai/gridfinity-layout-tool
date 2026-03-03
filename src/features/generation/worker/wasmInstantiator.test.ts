import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all heavy dependencies before importing the module under test
vi.mock('brepjs', () => ({
  initFromOC: vi.fn(),
}));

// Mock capability detection
const mockDetect = vi.fn();
vi.mock('@/shared/generation/wasmCapabilities', () => ({
  detectWasmCapabilities: () => mockDetect(),
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
  // Default: no threading support
  mockDetect.mockReturnValue({
    supportsThreads: false,
    hardwareConcurrency: 8,
    crossOriginIsolated: false,
  });
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

    it('uses single-threaded in dev mode even when threads are supported', async () => {
      // import.meta.env.DEV is true in vitest by default
      mockDetect.mockReturnValue({
        supportsThreads: true,
        hardwareConcurrency: 8,
        crossOriginIsolated: true,
      });

      const { loadOpenCascade } = await import('./wasmInstantiator');
      const result = await loadOpenCascade();

      expect(mockSingleInit).toHaveBeenCalledTimes(1);
      expect(mockThreadedInit).not.toHaveBeenCalled();
      expect(result.isThreaded).toBe(false);
    });
  });

  describe('threaded path', () => {
    it('uses threaded init when capabilities support it in production', async () => {
      // Stub import.meta.env.DEV to false for this test
      vi.stubEnv('DEV', '');

      mockDetect.mockReturnValue({
        supportsThreads: true,
        hardwareConcurrency: 8,
        crossOriginIsolated: true,
      });

      const { loadOpenCascade } = await import('./wasmInstantiator');
      const result = await loadOpenCascade();

      expect(mockThreadedInit).toHaveBeenCalledTimes(1);
      expect(mockSingleInit).not.toHaveBeenCalled();

      const config = mockThreadedInit.mock.calls[0][0] as {
        mainScriptUrlOrBlob: string;
        locateFile: (p: string) => string;
      };
      expect(config.mainScriptUrlOrBlob).toBe('/mocked/brepjs_threaded.js');
      expect(config.locateFile('brepjs_threaded.wasm')).toBe('/mocked/brepjs_threaded.wasm');
      expect(config.locateFile('brepjs_threaded.worker.js')).toBe(
        '/mocked/brepjs_threaded.worker.js'
      );
      expect(config.locateFile('other.txt')).toBe('other.txt');

      expect(result.isThreaded).toBe(true);
      expect(result.hardwareConcurrency).toBeGreaterThan(0);

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
