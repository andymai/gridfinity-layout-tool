import { describe, it, expect, vi, beforeEach } from 'vitest';

const heapBytesMock = vi.fn<() => number | null>(() => 128 * 1024 * 1024);

vi.mock('../wasmInstantiator', () => ({
  recoverBrepkitKernel: vi.fn(() => false),
  getLastBrepkitPanic: vi.fn(() => undefined),
  getKernelHeapBytes: () => heapBytesMock(),
}));
vi.mock('../generators/shapeCache', () => ({ clearAllCaches: vi.fn() }));
vi.mock('../generators/baseplateGenerator', () => ({ clearBaseplateCaches: vi.fn() }));
vi.mock('../generators/meshImprint', () => ({ clearMeshImprintCache: vi.fn() }));
vi.mock('../generators/estimateBin', () => ({ recordCompletedGeneration: vi.fn() }));

const { classifyExportError } = await import('./workerContext');

describe('classifyExportError', () => {
  beforeEach(() => {
    heapBytesMock.mockReturnValue(128 * 1024 * 1024);
  });

  it('reports a WASM trap as a kernel crash', () => {
    expect(classifyExportError(new WebAssembly.RuntimeError('table index is out of bounds'))).toBe(
      'KERNEL_CRASHED'
    );
  });

  it('reports a trap at the wasm32 heap ceiling as out of memory', () => {
    heapBytesMock.mockReturnValue(4 * 1024 * 1024 * 1024);
    expect(classifyExportError(new WebAssembly.RuntimeError('memory access out of bounds'))).toBe(
      'OUT_OF_MEMORY'
    );
  });

  it('does not read a grown heap as out of memory without a trap', () => {
    heapBytesMock.mockReturnValue(4 * 1024 * 1024 * 1024);
    expect(classifyExportError(new Error('BRep boolean operation failed'))).toBe(
      'BREP_BOOLEAN_FAILED'
    );
  });

  it('keeps the message-based codes for ordinary failures', () => {
    expect(classifyExportError(new Error('tessellation failed'))).toBe('MESH_TESSELLATION_FAILED');
    expect(classifyExportError(new Error('Invalid param: width'))).toBe('INVALID_PARAMS');
    expect(classifyExportError(new Error('empty solid'))).toBe('EMPTY_GEOMETRY');
    expect(classifyExportError(new Error('export timed out'))).toBe('TIMEOUT');
    expect(classifyExportError(new Error('something else'))).toBe('UNKNOWN');
  });
});
