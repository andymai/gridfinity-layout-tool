/**
 * Resolve the REAL generated 3D mesh for layout bins linked to saved designs,
 * so the layout preview can show each bin's actual interior (inserts, cutouts,
 * imported STL geometry) instead of a stylized open box.
 *
 * Resolution per design kind:
 * - `importedMesh`: the stored GMA1 asset IS the geometry — decoded on the
 *   main thread and re-framed to the preview convention (XY-centered, Z=0
 *   bottom), exactly like the worker's `importedMeshItem.generate`.
 * - `assembly`: generated through the item bridge (`generateItemImmediate`),
 *   content-addressed into the same cross-session mesh cache.
 * - `bin` (params): the cross-session IndexedDB mesh cache is tried first
 *   (`meshPersistence`, keyed by params hash + active kernel — instant for any
 *   design the user has opened); on a miss the mesh is generated via
 *   the shared generation bridge and persisted back for next time.
 *
 * Designs resolve sequentially through a module-level queue (the worker is
 * single-flight anyway) and results are cached module-wide keyed by design
 * id + updatedAt, so design edits invalidate stale meshes. Failures cache as
 * null — bins fall back to the stylized box (+ divider) rendering.
 *
 * Export prints a placement's resolved overhang IN PLACE OF the design's own,
 * and the preview draws the placement's as strips around the body. A bin
 * whose placement resolves one therefore gets a second variant of a design
 * that carries its own overhang, built without it, or the preview would show
 * both. Every other bin shares the design's single mesh.
 */

import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Bin, BinId, DesignId } from '@/core/types';
import type { BinParams } from '@/shared/types/bin';
import { isOk } from '@/core/result';
import {
  binDimensions,
  loadDesign,
  useCustomBins,
  type SavedDesign,
} from '@/features/bin-designer';
import { decodeMeshData } from '@/shared/generation/meshAsset';
import {
  binMeshCacheKey,
  itemMeshCacheKey,
  loadPersistedBinMesh,
  savePersistedBinMesh,
} from '@/shared/generation/meshPersistence';
import { bridgeManager, getActiveKernel } from '@/shared/generation/bridge';
import { withSocketNozzle } from '@/shared/generation/socketNozzle';
import { withLowProfileBase } from '@/shared/generation/lowProfileBase';
import { resolveBinOverhang } from '@/shared/utils/drawerMargin';
import { useSettingsStore } from '@/core/store';
import { useLayoutStore } from '@/core/store/layout';
import type { MeshData } from '@/shared/types/generation';
import type { GridfinityItem } from '@/shared/types/item';

/** A resolved design mesh ready for layout preview rendering. */
export interface LinkedDesignMesh {
  /** Stable identity for geometry caching (designId:updatedAt). */
  readonly sig: string;
  /** Preview-convention mesh: mm units, XY-centered on origin, Z=0 bottom. */
  readonly mesh: MeshData;
  /** Design footprint in grid units — detects rotated (w↔d) placement. */
  readonly width: number;
  readonly depth: number;
  /**
   * Z (mm, mesh frame) of the body's underside: where an overhang hangs from.
   * Parametric bins only; a stored or assembled mesh has no body to extend.
   */
  readonly bodyBaseMm?: number;
}

// Module-level cache shared across preview mounts. null = unsupported kind,
// decode/generation failure, or deleted design payload.
const meshCache = new Map<string, LinkedDesignMesh | null>();
const MAX_CACHE_ENTRIES = 32;
// Every waiter is called when its key settles, including one registered by a
// later mount: an effect that finds its key already in flight would otherwise
// never hear back, since the effect that started it was cleaned up.
const inFlight = new Map<string, Set<() => void>>();

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

function withoutOwnOverhang(params: BinParams): BinParams {
  if (params.overhang === undefined) return params;
  const { overhang: _drop, ...rest } = params;
  return rest;
}

/** One mesh to resolve: a design, optionally built without its own overhang. */
interface MeshRequest {
  readonly id: DesignId;
  readonly stripOwnOverhang: boolean;
}

async function resolveDesignMesh(
  design: SavedDesign,
  sig: string,
  nozzleSizeMm: number,
  lowProfileBase: boolean,
  stripOwnOverhang: boolean
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

  if (structure?.kind === 'assembly' && design.envelope) {
    const item: GridfinityItem = { envelope: design.envelope, structure };
    // Content-addressed like the bin path, so a returning user's drawer shows
    // the holder instantly without a worker round-trip.
    const persistKey = itemMeshCacheKey(item, getActiveKernel());
    const persisted = await loadPersistedBinMesh(persistKey);
    if (persisted) {
      return { sig, mesh: persisted, width: design.envelope.width, depth: design.envelope.depth };
    }
    const bridge = await bridgeManager.acquire();
    try {
      const result = await bridge.generateItemImmediate(item);
      if (result.mesh.vertices.length === 0) return null;
      const mesh = stripLabelPlates(result.mesh);
      savePersistedBinMesh(persistKey, mesh);
      return { sig, mesh, width: design.envelope.width, depth: design.envelope.depth };
    } finally {
      bridgeManager.release();
    }
  }

  const params = design.params;
  if (!params) return null;
  const source = stripOwnOverhang ? withoutOwnOverhang(params) : params;

  // Nozzle-merged (transient) so a socket bin's pocket matches the live print
  // setting and shares the same cache key the designer preview persists under.
  // The drawer decides the foot, whatever profile the design was saved with.
  const genParams = withLowProfileBase(withSocketNozzle(source, nozzleSizeMm), lowProfileBase);
  // Kernel-namespaced: this reader returns a hit and stops, with no regeneration
  // behind it, so a cross-engine hit would survive until LRU eviction.
  const persistKey = binMeshCacheKey(genParams, getActiveKernel());
  const bodyBaseMm = binDimensions(genParams).floorZ;
  const persisted = await loadPersistedBinMesh(persistKey);
  if (persisted) {
    return { sig, mesh: persisted, width: params.width, depth: params.depth, bodyBaseMm };
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
    return { sig, mesh, width: params.width, depth: params.depth, bodyBaseMm };
  } finally {
    bridgeManager.release();
  }
}

function enqueueResolve(
  request: MeshRequest,
  key: string,
  nozzleSizeMm: number,
  lowProfileBase: boolean,
  onSettled: () => void
): void {
  const waiters = inFlight.get(key);
  if (waiters) {
    waiters.add(onSettled);
    return;
  }
  inFlight.set(key, new Set([onSettled]));
  resolveChain = resolveChain.then(async () => {
    try {
      const designResult = await loadDesign(request.id);
      const entry = isOk(designResult)
        ? await resolveDesignMesh(
            designResult.value,
            key,
            nozzleSizeMm,
            lowProfileBase,
            request.stripOwnOverhang
          )
        : null;
      setCachedMesh(key, entry);
    } catch {
      // Worker init/generation failure — cache the miss so we don't retry
      // every render; a design re-save (new updatedAt) retries naturally.
      setCachedMesh(key, null);
    } finally {
      const settled = inFlight.get(key);
      inFlight.delete(key);
      for (const waiter of settled ?? []) waiter();
    }
  });
}

/**
 * Resolve the real design mesh for every linked bin. Returns a map keyed by
 * bin id; bins whose mesh is still loading (or unresolvable) are absent and
 * keep the stylized box rendering. Bins sharing a mesh share the same entry.
 */
export function useLinkedDesignMeshes(bins: Bin[]): Map<BinId, LinkedDesignMesh> {
  const registry = useCustomBins();
  const [loadTick, setLoadTick] = useState(0);
  // Part of the cache key so a nozzle change re-resolves socket-bin meshes at the
  // new pocket clearance. Non-socket designs re-resolve too but hit the persisted
  // mesh cache (their key is nozzle-invariant), so it stays cheap.
  const nozzleSizeMm = useSettingsStore((state) => state.settings.printSettings.nozzleSizeMm);
  const { lowProfileBase, drawer, baseplate } = useLayoutStore(
    useShallow((state) => ({
      lowProfileBase: state.layout.lowProfileBase === true,
      drawer: state.layout.drawer,
      baseplate: state.layout.baseplateParams,
    }))
  );

  const { requests, keyByBin } = useMemo(() => {
    const registryById = new Map(registry.map((ref) => [ref.id, ref]));
    const requests = new Map<string, MeshRequest>();
    const keyByBin = new Map<BinId, string>();
    for (const bin of bins) {
      if (bin.linkedDesignId === undefined) continue;
      const ref = registryById.get(bin.linkedDesignId);
      if (!ref) continue;
      const parametric = ref.kind === undefined || ref.kind === 'bin';
      // Only a parametric bin has a `params.overhang` to strip; an assembly's
      // `overhangMm` is parts standing past its plate. `overhangMm` answers
      // "does the design carry one" without loading its params; with none,
      // stripping changes nothing and the bin keeps the shared mesh.
      const stripOwnOverhang =
        parametric &&
        ref.overhangMm !== undefined &&
        resolveBinOverhang(bin, drawer, baseplate, ref.kind) !== null;
      // Quantize the nozzle so float noise (e.g. 0.6000000000000001) can't
      // fragment the cache key into avoidable misses.
      const key = `${ref.id}:${ref.updatedAt}:n${nozzleSizeMm.toFixed(3)}${
        // Only a parametric bin is rebuilt on the layout's foot.
        lowProfileBase && parametric ? ':lp' : ''
      }${stripOwnOverhang ? ':no-own-overhang' : ''}`;
      keyByBin.set(bin.id, key);
      if (!requests.has(key)) requests.set(key, { id: ref.id, stripOwnOverhang });
    }
    return { requests, keyByBin };
  }, [bins, registry, nozzleSizeMm, lowProfileBase, drawer, baseplate]);

  useEffect(() => {
    let cancelled = false;
    const onSettled = (): void => {
      if (!cancelled) setLoadTick((tick) => tick + 1);
    };
    for (const [key, request] of requests) {
      if (!meshCache.has(key))
        enqueueResolve(request, key, nozzleSizeMm, lowProfileBase, onSettled);
    }
    return () => {
      cancelled = true;
    };
  }, [requests, nozzleSizeMm, lowProfileBase]);

  return useMemo(() => {
    // loadTick re-runs this memo when async resolutions land in the cache
    void loadTick;
    const byKey = new Map<string, LinkedDesignMesh | null>();
    const meshes = new Map<BinId, LinkedDesignMesh>();
    for (const [id, key] of keyByBin) {
      let entry = byKey.get(key);
      if (entry === undefined) {
        entry = getCachedMesh(key) ?? null;
        byKey.set(key, entry);
      }
      if (entry) meshes.set(id, entry);
    }
    return meshes;
  }, [keyByBin, loadTick]);
}
