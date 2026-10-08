// @vitest-environment node
import { describe, it, expect, beforeAll, vi } from 'vitest';
import type { ManifoldToplevel } from 'manifold-3d';
import { clearMeshImprintCache, prepareMeshImprints } from './meshImprint';
import { decodeMeshEntry } from '../meshFiles';
import type * as MeshFilesModule from '../meshFiles';
import { encodeMeshData } from '@/shared/generation/meshAsset';
import type { MeshAsset } from '@/shared/generation/meshAsset';
import type { BinParams, Cutout } from '@/shared/types/bin';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { unwrap } from '@/core/result';

vi.mock('../meshFiles', async (importOriginal) => {
  const actual = await importOriginal<typeof MeshFilesModule>();
  return { ...actual, decodeMeshEntry: vi.fn(actual.decodeMeshEntry) };
});

let module: ManifoldToplevel;

beforeAll(async () => {
  const ManifoldModule = (await import('manifold-3d')).default;
  const { readFileSync } = await import('fs');
  const { join } = await import('path');
  const wasmBinary = readFileSync(join(process.cwd(), 'node_modules/manifold-3d/manifold.wasm'));
  module = await ManifoldModule({ wasmBinary } as unknown as { locateFile: () => string });
  module.setup();
}, 60_000);

async function boxAsset(width: number): Promise<MeshAsset> {
  // prettier-ignore
  const positions = new Float32Array([
    0, 0, 0, width, 0, 0, width, 10, 0, 0, 10, 0,
    0, 0, 5, width, 0, 5, width, 10, 5, 0, 10, 5,
  ]);
  // prettier-ignore
  const indices = new Uint32Array([
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4,
    2, 3, 7, 2, 7, 6, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5,
  ]);
  return {
    name: `box-${width}`,
    data: unwrap(await encodeMeshData(positions, indices)),
    triangleCount: 12,
    sizeMm: { x: width, y: 10, z: 5 },
    outlines: [
      [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: width, y: 10 },
        { x: 0, y: 10 },
      ],
    ],
  };
}

describe('prepareMeshImprints cache', () => {
  it('keeps every tool a design needs when it holds more meshes than the cache', async () => {
    const meshCount = 20;
    const meshAssets: Record<string, MeshAsset> = {};
    const cutouts: Cutout[] = [];
    for (let i = 0; i < meshCount; i++) {
      meshAssets[`asset-${i}`] = await boxAsset(10 + i);
      cutouts.push({
        id: `cutout-${i}`,
        shape: 'mesh',
        meshId: `asset-${i}`,
        x: 0,
        y: 0,
        width: 10 + i,
        depth: 10,
        cutDepth: 5,
        rotation: 0,
        cornerRadius: 0,
        label: '',
        groupId: null,
      });
    }
    const params: BinParams = { ...DEFAULT_BIN_PARAMS, style: 'solid', cutouts, meshAssets };

    clearMeshImprintCache();
    vi.mocked(decodeMeshEntry).mockClear();
    await prepareMeshImprints(params, module);
    await prepareMeshImprints(params, module);

    expect(vi.mocked(decodeMeshEntry)).toHaveBeenCalledTimes(meshCount);
    clearMeshImprintCache();
  }, 60_000);
});
