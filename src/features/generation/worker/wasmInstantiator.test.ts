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

// Mock wasmCapabilities (always single-threaded in tests/dev)
vi.mock('@/shared/generation/wasmCapabilities', () => ({
  detectWasmCapabilities: () => ({ supportsThreads: false }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockSingleInit.mockResolvedValue({ ready: true });
  mockThreadedInit.mockResolvedValue({ ready: true });
});

describe('wasmInstantiator', () => {
  it('calls single-threaded init in dev mode', async () => {
    const { loadOpenCascade } = await import('./wasmInstantiator');

    const result = await loadOpenCascade();

    expect(mockSingleInit).toHaveBeenCalledTimes(1);
    expect(mockSingleInit).toHaveBeenCalledWith();
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
