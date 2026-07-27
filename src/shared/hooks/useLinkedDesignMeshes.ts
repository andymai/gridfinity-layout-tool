/**
 * Resolve the REAL generated 3D mesh for layout bins linked to saved designs,
 * so the layout preview can show each bin's actual interior (inserts, cutouts,
 * imported STL geometry) instead of a stylized open box.
 *
 * Resolution per design kind:
 * - `importedMesh`: the stored GMA1 asset IS the geometry — decoded on the
 *   main thread and re-framed to the preview convention (XY-centered, Z=0
 *   bottom), exactly like the worker's `importedMeshItem.generate`.
 * - `bin` (params): the cross-session IndexedDB mesh cache is tried first
 *   (`meshPersistence`, keyed by params hash — instant for any design the
 *   user has opened); on a miss the mesh is generated in the background via
 *   the shared generation bridge and persisted back for next time.
 *
 * Designs resolve sequentially through a module-level queue (the worker is
 * single-flight anyway) and results are cached module-wide keyed by design
 * id + updatedAt, so design edits invalidate stale meshes. Failures cache as
 * null — bins fall back to the stylized box (+ divider) rendering.
 */

import { useEffect, useMemo, useState } from 'react';
import type { Bin, DesignId } from '@/core/types';
import { isOk } from '@/core/result';
import { loadDesign, useCustomBins, type SavedDesign } from '@/features/bin-designer';
import { decodeMeshData } from '@/shared/generation/meshAsset';
import {
  binMeshCacheKey,
  loadPersistedBinMesh,
  savePersistedBinMesh,
} from '@/shared/generation/meshPersistence';
import { bridgeManager } from '@/shared/generation/bridge';
import { withSocketNozzle } from '@/shared/generation/socketNozzle';
import { useSettingsStore } from '@/core/store';
import type { MeshData } from '@/shared/types/generation';

/** A resolved design mesh ready for layout preview rendering. */
export interface LinkedDesignMesh {
  /** Stable identity for geometry caching (designId:updatedAt). */
  readonly sig: string;
  /** Preview-convention mesh: mm units, XY-centered on origin, Z=0 bottom. */
  readonly mesh: MeshData;
  /** Design footprint in grid units — detects rotated (w↔d) placement. */
  readonly width: number;
  readonly depth: number;
}

// Module-level cache shared across preview mounts. null = unsupported kind,
// decode/generation failure, or deleted design payload.
const meshCache = new Map<string, LinkedDesignMesh | null>();
const MAX_CACHE_ENTRIES = 32;
const inFlight = new Set<string>();

// Sequential resolution queue: one design at a time, so a layout with many
// uncached linked designs doesn't stampede the (single-flight) worker.
let resolveChain: Promise<void> = Promise.resolve();

/** Reset module state. @internal — for tests only. */
export function clearLinkedDesignMeshCache(): void {
  meshCache.clear();
  inFlight.clear();
  resolveChain = Promise.resolve();
}

// Insert an entry, evicting the least-recently-used on overflow. Recency is
// refreshed on read by getCachedMesh, so a still-visible design is never
// evicted by an unrelated insert (matches designGeometryCache's LRU policy).
function setCachedMesh(key: string, entry: LinkedDesignMesh | null): void {
  if (meshCache.size >= MAX_CACHE_ENTRIES && !meshCache.has(key)) {
    const oldestKey = meshCache.keys().next().value;
    if (oldestKey !== undefined) meshCache.delete(oldestKey);
  }
  meshCache.set(key, entry);
}

// Read a cached entry (including a cached null miss), promoting it to
// most-recently-used. Returns undefined when the key is absent.
function getCachedMesh(key: string): LinkedDesignMesh | null | undefined {
  if (!meshCache.has(key)) return undefined;
  const entry = meshCache.get(key) ?? null;
  meshCache.delete(key);
  meshCache.set(key, entry);
  return entry;
}

/** Re-frame a stored imported mesh (bbox min at origin) to XY-centered. */
function centerImportedVertices(
  positions: Float32Array,
  sizeX: number,
  sizeY: number
): Float32Array {
  const centered = new Float32Array(positions.length);
  const dx = sizeX / 2;
  const dy = sizeY / 2;
  for (let i = 0; i < positions.length; i += 3) {
    centered[i] = positions[i] - dx;
    centered[i + 1] = positions[i + 1] - dy;
    centered[i + 2] = positions[i + 2];
  }
  return centered;
}

/**
 * Drop label-plate buffers, which are a bin-designer preview affordance.
 *
 * Returns the mesh unchanged when there are none, so the common path keeps its
 * identity instead of allocating a wrapper on every resolve.
 */
function stripLabelPlates(mesh: MeshData): MeshData {
  if (!mesh.labelPlates) return mesh;
  const { labelPlates: _plates, ...rest } = mesh;
  void _plates;
  return rest;
}

async function resolveDesignMesh(
  design: SavedDesign,
  sig: string,
  nozzleSizeMm: number
): Promise<LinkedDesignMesh | null> {
  const structure = design.structure;
  if (structure?.kind === 'importedMesh' && design.envelope) {
    const decoded = await decodeMeshData(structure.asset.data);
    if (!isOk(decoded)) return null;
    const { positions, indices } = decoded.value;
    const mesh: MeshData = {
      vertices: centerImportedVertices(
        positions,
        structure.asset.sizeMm.x,
        structure.asset.sizeMm.y
      ),
      // Empty normals/edges — the geometry builder computes creased normals.
      normals: new Float32Array(0),
      indices,
      edgeVertices: new Float32Array(0),
      triangleCount: indices.length / 3,
    };
    return { sig, mesh, width: design.envelope.width, depth: design.envelope.depth };
  }

  const params = design.params;
  if (!params) return null;

  // Nozzle-merged (transient) so a socket bin's pocket matches the live print
  // setting and shares the same cache key the designer preview persists under.
  const genParams = withSocketNozzle(params, nozzleSizeMm);
  const persistKey = binMeshCacheKey(genParams);
  const persisted = await loadPersistedBinMesh(persistKey);
  if (persisted) {
    return { sig, mesh: persisted, width: params.width, depth: params.depth };
  }

  // Cold path: generate the exact preview mesh in the worker (same flow as
  // background thumbnail regeneration) and persist it for future sessions.
  const bridge = await bridgeManager.acquire();
  try {
    const result = await bridge.generateImmediate(genParams);
    if (result.mesh.vertices.length === 0) return null;
    // Label plates are a bin-designer preview affordance and are not requested
    // here, but the bridge's params cache is shared across callers — so a
    // designer result could alias in. Strip them rather than bake plate buffers
    // into every cross-session cache entry.
    const mesh = stripLabelPlates(result.mesh);
    savePersistedBinMesh(persistKey, mesh);
    return { sig, mesh, width: params.width, depth: params.depth };
  } finally {
    bridgeManager.release();
  }
}

function enqueueResolve(
  id: DesignId,
  key: string,
  nozzleSizeMm: number,
  onSettled: () => void
): void {
  if (inFlight.has(key)) return;
  inFlight.add(key);
  resolveChain = resolveChain.then(async () => {
    try {
      const designResult = await loadDesign(id);
      const entry = isOk(designResult)
        ? await resolveDesignMesh(designResult.value, key, nozzleSizeMm)
        : null;
      setCachedMesh(key, entry);
    } catch {
      // Worker init/generation failure — cache the miss so we don't retry
      // every render; a design re-save (new updatedAt) retries naturally.
      setCachedMesh(key, null);
    } finally {
      inFlight.delete(key);
      onSettled();
    }
  });
}

/**
 * Resolve real design meshes for every design linked from the given bins.
 * Returns a map keyed by design id; designs still loading (or unresolvable)
 * are absent and their bins keep the stylized box rendering.
 */
export function useLinkedDesignMeshes(bins: Bin[]): Map<DesignId, LinkedDesignMesh> {
  const registry = useCustomBins();
  const [loadTick, setLoadTick] = useState(0);
  // Part of the cache key so a nozzle change re-resolves socket-bin meshes at the
  // new pocket clearance. Non-socket designs re-resolve too but hit the persisted
  // mesh cache (their key is nozzle-invariant), so it stays cheap.
  const nozzleSizeMm = useSettingsStore((state) => state.settings.printSettings.nozzleSizeMm);

  const linkedRefs = useMemo(() => {
    const registryById = new Map(registry.map((ref) => [ref.id, ref]));
    const refs = new Map<DesignId, string>();
    for (const bin of bins) {
      if (bin.linkedDesignId === undefined || refs.has(bin.linkedDesignId)) continue;
      const ref = registryById.get(bin.linkedDesignId);
      // Quantize the nozzle so float noise (e.g. 0.6000000000000001) can't
      // fragment the cache key into avoidable misses.
      if (ref)
        refs.set(bin.linkedDesignId, `${ref.id}:${ref.updatedAt}:n${nozzleSizeMm.toFixed(3)}`);
    }
    return refs;
  }, [bins, registry, nozzleSizeMm]);

  useEffect(() => {
    let cancelled = false;
    const onSettled = (): void => {
      if (!cancelled) setLoadTick((tick) => tick + 1);
    };
    for (const [id, key] of linkedRefs) {
      if (!meshCache.has(key)) enqueueResolve(id, key, nozzleSizeMm, onSettled);
    }
    return () => {
      cancelled = true;
    };
  }, [linkedRefs, nozzleSizeMm]);

  return useMemo(() => {
    // loadTick re-runs this memo when async resolutions land in the cache
    void loadTick;
    const meshes = new Map<DesignId, LinkedDesignMesh>();
    for (const [id, key] of linkedRefs) {
      const entry = getCachedMesh(key);
      if (entry) meshes.set(id, entry);
    }
    return meshes;
  }, [linkedRefs, loadTick]);
}
