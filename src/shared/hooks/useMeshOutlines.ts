/**
 * React access to mesh silhouettes, which a ref keeps in its mesh file rather
 * than in the design. Each hook starts reading the files whose outlines this
 * thread does not have yet and re-renders when they arrive; a ref whose file
 * is not on this device keeps reading as pending.
 */

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { MeshAssetEntry, MeshOutlinePoint } from '@/shared/generation/meshAsset';
import {
  meshAssetOutlines,
  meshOutlinesRevision,
  subscribeMeshOutlines,
} from '@/shared/generation/meshOutlines';
import { loadMeshOutlines } from '@/shared/generation/meshRefs';

type MeshAssetMap = Readonly<Record<string, MeshAssetEntry>>;

/** One entry's outline rings, or undefined while it is pending. */
export function useMeshAssetOutlines(
  entry: MeshAssetEntry | undefined
): MeshOutlinePoint[][] | undefined {
  useSyncExternalStore(subscribeMeshOutlines, meshOutlinesRevision);
  useEffect(() => {
    if (entry) void loadMeshOutlines([entry]);
  }, [entry]);
  return meshAssetOutlines(entry);
}

/**
 * `meshAssets` under a fresh identity whenever a silhouette arrives, so every
 * memo and callback keyed on the map re-reads the outlines through it.
 */
export function useLoadedMeshAssets(
  meshAssets: MeshAssetMap | undefined
): MeshAssetMap | undefined {
  const revision = useSyncExternalStore(subscribeMeshOutlines, meshOutlinesRevision);
  useEffect(() => {
    if (meshAssets) void loadMeshOutlines(Object.values(meshAssets));
  }, [meshAssets]);
  return useMemo(() => {
    void revision;
    return meshAssets ? { ...meshAssets } : undefined;
  }, [meshAssets, revision]);
}
