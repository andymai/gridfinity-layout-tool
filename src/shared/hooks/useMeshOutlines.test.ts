import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { MeshAsset, MeshAssetRef } from '@/shared/generation/meshAsset';
import {
  MAX_UNHELD_OUTLINES,
  __clearMeshOutlinesForTests,
  hasMeshOutlines,
  setMeshOutlines,
} from '@/shared/generation/meshOutlines';
import { meshAssetFile, storeMeshAsset } from '@/shared/generation/meshRefs';
import { __resetMeshStoreForTests, putMeshFile } from '@/shared/generation/meshStore';
import { useLoadedMeshAssets, useMeshAssetOutlines } from './useMeshOutlines';

const asset: MeshAsset = {
  name: 'wrench',
  data: 'AAAA',
  triangleCount: 1,
  sizeMm: { x: 20, y: 10, z: 5 },
  outlines: [
    [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 0, y: 10 },
    ],
  ],
};

const absent: MeshAssetRef = {
  name: 'gone',
  hash: '9'.repeat(64),
  triangleCount: 1,
  sizeMm: { x: 1, y: 1, z: 1 },
  bytes: 1,
};

async function storedRef(): Promise<MeshAssetRef> {
  const ref = await storeMeshAsset({ ...asset });
  if (!ref) throw new Error('store failed');
  __clearMeshOutlinesForTests();
  return ref;
}

beforeEach(() => {
  __resetMeshStoreForTests();
  __clearMeshOutlinesForTests();
});

afterEach(() => {
  __resetMeshStoreForTests();
});

describe('useMeshAssetOutlines', () => {
  it('reads an inline asset directly', () => {
    const { result } = renderHook(() => useMeshAssetOutlines(asset));
    expect(result.current).toBe(asset.outlines);
  });

  it('loads a ref from the mesh store and re-renders with its outlines', async () => {
    const ref = await storedRef();
    const { result } = renderHook(() => useMeshAssetOutlines(ref));
    expect(result.current).toBeUndefined();
    await waitFor(() => expect(result.current).toEqual(asset.outlines));
  });

  it('holds the outlines it shows until it unmounts', async () => {
    const ref = await storedRef();
    const { result, unmount } = renderHook(() => useMeshAssetOutlines(ref));
    await waitFor(() => expect(result.current).toEqual(asset.outlines));
    const filler = (i: number): string => (i + 1).toString(16).padStart(64, '0');
    for (let i = 0; i < MAX_UNHELD_OUTLINES; i++) setMeshOutlines(filler(i), asset.outlines);
    expect(hasMeshOutlines(ref.hash)).toBe(true);

    unmount();

    expect(hasMeshOutlines(ref.hash)).toBe(false);
  });

  it('keeps a ref whose file is not on this device pending', async () => {
    const { result } = renderHook(() => useMeshAssetOutlines(absent));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current).toBeUndefined();
  });

  it('loads the outlines once a missing file arrives', async () => {
    const file = await meshAssetFile({ ...asset, data: 'AAAE' });
    if (!file) throw new Error('fixture');
    const { result } = renderHook(() => useMeshAssetOutlines(file.ref));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current).toBeUndefined();

    await putMeshFile(file.bytes);

    await waitFor(() => expect(result.current).toEqual(asset.outlines));
  });
});

describe('useLoadedMeshAssets', () => {
  it('hands back a fresh map once a silhouette arrives, so memos keyed on it re-read', async () => {
    const ref = await storedRef();
    const meshAssets = { m1: ref };
    const { result } = renderHook(() => useLoadedMeshAssets(meshAssets));
    const first = result.current;
    expect(first).toEqual(meshAssets);

    await waitFor(() => expect(result.current).not.toBe(first));
    expect(result.current).toEqual(meshAssets);
  });

  it('passes undefined through', () => {
    const { result } = renderHook(() => useLoadedMeshAssets(undefined));
    expect(result.current).toBeUndefined();
  });
});
