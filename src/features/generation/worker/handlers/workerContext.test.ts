import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const heapBytesMock = vi.fn<() => number | null>(() => 128 * 1024 * 1024);

/**
 * The largest heap the linked occt-wasm build can grow to, read from its
 * Emscripten glue: the size a kernel that ran out of memory reports.
 */
function occtHeapMaxBytes(): number {
  const glue = readFileSync(
    join(process.cwd(), 'node_modules/occt-wasm/dist/occt-wasm.js'),
    'utf8'
  );
  const match = /getHeapMax=\(\)=>(\d+)/.exec(glue);
  if (!match) throw new Error('occt-wasm glue no longer states getHeapMax as a literal');
  return Number(match[1]);
}

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

  it('reports a trap with the heap at the kernel maximum as out of memory', () => {
    heapBytesMock.mockReturnValue(occtHeapMaxBytes());
    expect(classifyExportError(new WebAssembly.RuntimeError('memory access out of bounds'))).toBe(
      'OUT_OF_MEMORY'
    );
  });

  it('does not read a grown heap as out of memory without a trap', () => {
    heapBytesMock.mockReturnValue(occtHeapMaxBytes());
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

describe('runExport on a kernel that ran out of memory', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    heapBytesMock.mockReturnValue(128 * 1024 * 1024);
  });

  it('answers OUT_OF_MEMORY with the out-of-memory wording', async () => {
    // A fresh module: the trap latches the kernel as crashed for the rest of
    // the module's life.
    vi.resetModules();
    const ctx = await import('./workerContext');
    const posted: Record<string, unknown>[] = [];
    vi.stubGlobal('self', {
      postMessage: (response: Record<string, unknown>) => {
        posted.push(response);
      },
    });
    ctx.setKernelInitialized('occt-wasm', false, 1);
    heapBytesMock.mockReturnValue(occtHeapMaxBytes());

    await ctx.runExport(
      'oom-export',
      'COMBINED_EXPORT_RESULT',
      () => Promise.reject(new WebAssembly.RuntimeError('memory access out of bounds')),
      'Combined export failed',
      () => [],
      ctx.classifyExportError
    );

    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ type: 'ERROR', errorCode: 'OUT_OF_MEMORY' });
    expect(posted[0].error).toMatch(/^Combined export failed: Geometry kernel ran out of memory/);
  });
});
