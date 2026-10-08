import { afterEach, describe, expect, it } from 'vitest';
import { isOk, unwrap } from '@/core/result';
import { encodeMeshData } from '@/shared/generation/meshAsset';
import type { MeshAsset, MeshAssetRef } from '@/shared/generation/meshAsset';
import { encodeMeshFile } from '@/shared/generation/meshFile';
import { meshAssetOutlines } from '@/shared/generation/meshOutlines';
import {
  __clearMeshFilesForTests,
  beginMeshRequest,
  decodeMeshEntry,
  dropMeshFile,
  meshEntryKey,
  receiveMeshFile,
} from './meshFiles';

const HASH = 'd'.repeat(64);

async function makeAsset(): Promise<MeshAsset> {
  const positions = new Float32Array([0, 0, 0, 30, 0, 0, 0, 30, 0, 0, 0, 30]);
  const indices = new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]);
  return {
    name: 'tool',
    data: unwrap(await encodeMeshData(positions, indices)),
    triangleCount: 4,
    sizeMm: { x: 30, y: 30, z: 30 },
    outlines: [
      [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
        { x: 0, y: 30 },
      ],
    ],
  };
}

function refTo(asset: MeshAsset): MeshAssetRef {
  return { name: asset.name, hash: HASH, triangleCount: 4, sizeMm: asset.sizeMm, bytes: 1 };
}

afterEach(() => {
  __clearMeshFilesForTests();
});

describe('worker mesh files', () => {
  it('reads a ref through the file the bridge sent, outlines included', async () => {
    const asset = await makeAsset();
    receiveMeshFile(HASH, unwrap(encodeMeshFile(asset)));

    const decoded = await decodeMeshEntry(refTo(asset));
    const inline = await decodeMeshEntry(asset);

    expect(decoded && isOk(decoded) && inline && isOk(inline)).toBe(true);
    expect(decoded && unwrap(decoded)).toEqual(inline && unwrap(inline));
    expect(meshAssetOutlines(refTo(asset))).toEqual(asset.outlines);
    expect(meshEntryKey(refTo(asset))).toBe(HASH);
    expect(meshEntryKey(asset)).toBe(asset.data);
  });

  it('reads a ref whose file was never sent as pending', async () => {
    const asset = await makeAsset();
    expect(await decodeMeshEntry(refTo(asset))).toBeNull();
    expect(meshAssetOutlines(refTo(asset))).toBeUndefined();
  });

  it('ignores a file that does not parse', async () => {
    const asset = await makeAsset();
    receiveMeshFile(HASH, new Uint8Array([1, 2, 3]));
    expect(await decodeMeshEntry(refTo(asset))).toBeNull();
  });

  it('holds a drop that lands mid-request until the request ends', async () => {
    const asset = await makeAsset();
    receiveMeshFile(HASH, unwrap(encodeMeshFile(asset)));
    const end = beginMeshRequest();

    dropMeshFile(HASH);
    expect(meshAssetOutlines(refTo(asset))).toEqual(asset.outlines);

    end();
    end();
    expect(meshAssetOutlines(refTo(asset))).toBeUndefined();
    expect(await decodeMeshEntry(refTo(asset))).toBeNull();
  });

  it('keeps a file sent again after a deferred drop', async () => {
    const asset = await makeAsset();
    const file = unwrap(encodeMeshFile(asset));
    receiveMeshFile(HASH, file);
    const end = beginMeshRequest();
    dropMeshFile(HASH);
    receiveMeshFile(HASH, file);
    end();
    expect(meshAssetOutlines(refTo(asset))).toEqual(asset.outlines);
  });
});
