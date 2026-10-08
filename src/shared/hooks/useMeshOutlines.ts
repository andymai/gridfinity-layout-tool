/**
 * React access to mesh silhouettes, which a ref keeps in its mesh file rather
 * than in the design. Each hook starts reading the files whose outlines this
 * thread does not have yet and re-renders when they arrive; a ref whose file
 * is not on this device keeps reading as pending.
 */

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { MeshAssetEntry, MeshOutlinePoint } from '@/shared/generation/meshAsset';
import { isMeshAssetRef } from '@/shared/generation/meshAsset';
import {
  holdMeshOutlines,
  meshAssetOutlines,
  meshOutlinesRevision,
  subscribeMeshOutlines,
} from '@/shared/generation/meshOutlines';
import { loadMeshOutlines } from '@/shared/generation/meshRefs';

type MeshAssetMap = Readonly<Record<string, MeshAssetEntry>>;

/** Hold and load the outlines of every ref in `entries`; the returned function lets go. */
function holdAndLoad(entries: readonly MeshAssetEntry[]): () => void {
  const release = holdMeshOutlines(entries.flatMap((e) => (isMeshAssetRef(e) ? [e.hash] : [])));
  void loadMeshOutlines(entries);
  return release;
}

/** One entry's outline rings, or undefined while it is pending. */
export function useMeshAssetOutlines(
  entry: MeshAssetEntry | undefined
): MeshOutlinePoint[][] | undefined {
  useSyncExternalStore(subscribeMeshOutlines, meshOutlinesRevision);
  useEffect(() => (entry ? holdAndLoad([entry]) : undefined), [entry]);
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
  useEffect(() => (meshAssets ? holdAndLoad(Object.values(meshAssets)) : undefined), [meshAssets]);
  return useMemo(() => {
    void revision;
    return meshAssets ? { ...meshAssets } : undefined;
  }, [meshAssets, revision]);
}
