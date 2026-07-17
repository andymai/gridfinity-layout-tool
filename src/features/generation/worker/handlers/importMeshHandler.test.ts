import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ok, err } from '@/core/result';
import type { ImportMeshMessage } from '../../bridge/types';

const importMeshFromStl = vi.fn();
vi.mock('../generators/meshImport', () => ({
  importMeshFromStl: (...args: unknown[]) => importMeshFromStl(...args),
}));

import { handleImportMesh } from './importMeshHandler';

const postMessage = vi.fn();

function message(): ImportMeshMessage {
  return {
    type: 'IMPORT_MESH',
    payload: { requestId: 'import-1', buffer: new ArrayBuffer(8), fileName: 'tool.stl' },
  };
}

beforeEach(() => {
  vi.stubGlobal('self', { postMessage });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('handleImportMesh', () => {
  it('posts the result with transferred arrays on success', async () => {
    const positions = new Float32Array([0, 0, 0]);
    const indices = new Uint32Array([0, 1, 2]);
    importMeshFromStl.mockResolvedValue(
      ok({
        asset: {
          name: 'tool',
          data: 'x',
          triangleCount: 1,
          sizeMm: { x: 1, y: 1, z: 1 },
          outlines: [],
        },
        positions,
        indices,
        suggestedCutDepth: 1,
      })
    );

    await handleImportMesh(message());

    expect(postMessage).toHaveBeenCalledTimes(1);
    const [response, options] = postMessage.mock.calls[0];
    expect(response.type).toBe('IMPORT_MESH_RESULT');
    expect(response.requestId).toBe('import-1');
    expect(response.suggestedCutDepth).toBe(1);
    expect(options.transfer).toEqual([positions.buffer, indices.buffer]);
  });

  it('posts a typed error when the pipeline reports one', async () => {
    importMeshFromStl.mockResolvedValue(err({ reason: 'not_manifold', message: 'mesh has holes' }));

    await handleImportMesh(message());

    expect(postMessage).toHaveBeenCalledWith({
      type: 'IMPORT_MESH_ERROR',
      requestId: 'import-1',
      reason: 'not_manifold',
      error: 'mesh has holes',
    });
  });

  it('converts unexpected throws into parse_failed errors', async () => {
    importMeshFromStl.mockRejectedValue(new Error('wasm exploded'));

    await handleImportMesh(message());

    expect(postMessage).toHaveBeenCalledWith({
      type: 'IMPORT_MESH_ERROR',
      requestId: 'import-1',
      reason: 'parse_failed',
      error: 'wasm exploded',
    });
  });
});
