import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeshAsset, MeshAssetRef, MeshOutlinePoint } from './meshAsset';
import {
  __clearMeshOutlinesForTests,
  deleteMeshOutlines,
  meshAssetOutlines,
  meshOutlinesRevision,
  setMeshOutlines,
  subscribeMeshOutlines,
} from './meshOutlines';

const rings: MeshOutlinePoint[][] = [
  [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ],
];

const inline: MeshAsset = {
  name: 'a',
  data: 'AAAA',
  triangleCount: 1,
  sizeMm: { x: 1, y: 1, z: 1 },
  outlines: rings,
};

const ref: MeshAssetRef = {
  name: 'a',
  hash: 'a'.repeat(64),
  triangleCount: 1,
  sizeMm: { x: 1, y: 1, z: 1 },
  bytes: 1,
};

beforeEach(() => {
  __clearMeshOutlinesForTests();
});

describe('meshAssetOutlines', () => {
  it('reads an inline asset directly and a ref through the registry', () => {
    expect(meshAssetOutlines(inline)).toBe(rings);
    expect(meshAssetOutlines(ref)).toBeUndefined();
    setMeshOutlines(ref.hash, rings);
    expect(meshAssetOutlines(ref)).toBe(rings);
    expect(meshAssetOutlines(undefined)).toBeUndefined();
  });

  it('notifies when outlines arrive or leave, and not when a known hash is set again', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeMeshOutlines(listener);
    const before = meshOutlinesRevision();

    setMeshOutlines(ref.hash, rings);
    setMeshOutlines(
      ref.hash,
      rings.map((ring) => [...ring])
    );
    expect(listener).toHaveBeenCalledTimes(1);
    expect(meshOutlinesRevision()).toBe(before + 1);

    deleteMeshOutlines(ref.hash);
    deleteMeshOutlines(ref.hash);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});
