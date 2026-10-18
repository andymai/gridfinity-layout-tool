import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

const { classifyExportError, runGeneration, setKernelInitialized } =
  await import('./workerContext');

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

describe('runGeneration companion meshes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts a slanted bin end support with its buffers transferred', () => {
    const posted: { response: Record<string, unknown>; transfer: Transferable[] }[] = [];
    vi.stubGlobal('self', {
      postMessage: (response: Record<string, unknown>, options?: { transfer?: Transferable[] }) => {
        posted.push({ response, transfer: options?.transfer ?? [] });
      },
    });
    setKernelInitialized('occt-wasm', false, 1);
    const part = () => ({
      vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      indices: new Uint32Array([0, 1, 2]),
      edgeVertices: new Float32Array([0, 0, 0, 1, 0, 0]),
      triangleCount: 1,
    });
    runGeneration(() => ({ ...part(), slantSupportMesh: part() }), 'slant-support', 'test', false);

    const result = posted.find((p) => p.response.type === 'MESH_RESULT');
    expect(result).toBeDefined();
    if (!result) return;
    expect(result.response.slantSupportTriangleCount).toBe(1);
    const vertices = result.response.slantSupportVertices as Float32Array;
    expect(Array.from(vertices)).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    expect(result.transfer).toContain(vertices.buffer);
  });
});
