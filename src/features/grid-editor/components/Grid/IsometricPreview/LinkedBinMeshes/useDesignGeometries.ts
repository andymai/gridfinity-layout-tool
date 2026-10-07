import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BinId } from '@/core/types';
import type { MeshData } from '@/shared/types/generation';
import type { LinkedDesignMesh } from '@/shared/hooks/useLinkedDesignMeshes';
import { CREASE_ANGLE_RAD } from '@/shared/constants/tessellation';

/** A ready-to-render design geometry, shared by every bin that resolves to the same mesh. */
export interface DesignGeometryEntry {
  readonly sig: string;
  readonly geometry: THREE.BufferGeometry;
  /** Design footprint in grid units — detects rotated (w↔d) placement. */
  readonly width: number;
  readonly depth: number;
  /** Z (mm) of the body's underside in the rendered frame, feet lift included. */
  readonly bodyBaseMm?: number;
  /**
   * Companion handle-rest geometry for a knife-block design. A layout bin
   * with `pairRole: 'rest'` renders THIS instead of the block body; footprint
   * carried in mm because the grid-unit conversion belongs to the renderer.
   */
  readonly rest?: {
    readonly geometry: THREE.BufferGeometry;
    readonly widthMm: number;
    readonly depthMm: number;
  };
}

/**
 * Module-level geometry cache keyed by design sig (designId:updatedAt), the
 * same pattern as MergedBinMeshes' geometryCache: LRU eviction with disposal,
 * cleared wholesale when the owning preview unmounts (layout switch).
 */
const designGeometryCache = new Map<string, THREE.BufferGeometry>();
/** Bound on geometries no mounted preview is drawing. @internal, exported for tests. */
export const MAX_CACHE_SIZE = 64;
// Keys a committed preview is drawing, refcounted across mounts. Never evicted,
// so building past the bound cannot dispose a geometry a visible bin binds.
const pinnedGeometryKeys = new Map<string, number>();
let trimScheduled = false;

/** Clear all cached design geometries and dispose them. */
export function clearDesignGeometryCache(): void {
  for (const geometry of designGeometryCache.values()) {
    geometry.dispose();
  }
  designGeometryCache.clear();
  pinnedGeometryKeys.clear();
}

function pinGeometry(key: string): void {
  pinnedGeometryKeys.set(key, (pinnedGeometryKeys.get(key) ?? 0) + 1);
}

function unpinGeometry(key: string): void {
  const count = pinnedGeometryKeys.get(key) ?? 0;
  if (count <= 1) pinnedGeometryKeys.delete(key);
  else pinnedGeometryKeys.set(key, count - 1);
}

// Dispose least-recently-used geometries that are neither pinned nor in
// `inUse` until at most `limit` such remain.
function evictUnused(limit: number, inUse: ReadonlySet<string>): void {
  const used = (key: string): boolean => pinnedGeometryKeys.has(key) || inUse.has(key);
  let unused = 0;
  for (const key of designGeometryCache.keys()) if (!used(key)) unused++;
  for (const [key, geometry] of designGeometryCache) {
    if (unused <= limit) return;
    if (used(key)) continue;
    geometry.dispose();
    designGeometryCache.delete(key);
    unused--;
  }
}

// Deferred past the effect cleanup and setup React runs back to back, so an
// update re-pins what it still draws before anything unpinned is disposed.
function scheduleTrim(): void {
  if (trimScheduled) return;
  trimScheduled = true;
  queueMicrotask(() => {
    trimScheduled = false;
    evictUnused(MAX_CACHE_SIZE, new Set());
  });
}

/** Concatenate a companion part's buffers onto the body's, shifting its indices. */
function mergeParts(
  body: MeshData,
  part: MeshData | undefined
): { vertices: Float32Array; indices: Uint32Array } {
  if (!part || part.vertices.length === 0) {
    return { vertices: body.vertices, indices: body.indices };
  }
  const vertices = new Float32Array(body.vertices.length + part.vertices.length);
  vertices.set(body.vertices, 0);
  vertices.set(part.vertices, body.vertices.length);

  const offset = body.vertices.length / 3;
  const indices = new Uint32Array(body.indices.length + part.indices.length);
  indices.set(body.indices, 0);
  for (let i = 0; i < part.indices.length; i++) {
    indices[body.indices.length + i] = part.indices[i] + offset;
  }
  return { vertices, indices };
}

const feetLiftMemo = new WeakMap<MeshData, number>();

function detachableFeetLiftMm(mesh: MeshData): number {
  const memo = feetLiftMemo.get(mesh);
  if (memo !== undefined) return memo;
  const feet = mesh.detachableFeetMesh?.vertices;
  let lift = 0;
  if (feet) {
    for (let i = 2; i < feet.length; i += 3) lift = Math.max(lift, -feet[i]);
  }
  feetLiftMemo.set(mesh, lift);
  return lift;
}

/**
 * Build a renderable geometry from worker/imported mesh data. Mirrors
 * `useMeshGeometry`'s shading rules: worker meshes (with precomputed normals)
 * get crease-angle normal splitting so BREP edges stay sharp; imported meshes
 * (no normals) get plain smooth vertex normals.
 */
export function buildDesignGeometry(mesh: MeshData): THREE.BufferGeometry {
  // Detachable feet are part of the object, not a companion the layout can
  // leave out: without them a linked bin draws as a flat-bottomed box sitting a
  // socket lower than an identical neighbour. They arrive positioned in the
  // bin's own frame — feet spanning [-socket depth, 0], body starting at 0 —
  // so after concatenating, the whole assembly must be LIFTED a socket to keep
  // the preview contract (Z=0 bottom) that `LinkedBinMesh` positions by.
  // Concatenating alone puts the feet through the layer plane while the rim
  // still sits a socket below an integral neighbour's. The lift is read off the
  // feet themselves, since a low-profile drawer builds them shorter.
  const { vertices, indices } = mergeParts(mesh, mesh.detachableFeetMesh);
  const lift = detachableFeetLiftMm(mesh);
  if (lift > 0) {
    for (let i = 2; i < vertices.length; i += 3) {
      vertices[i] += lift;
    }
  }

  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  if (indices.length > 0) {
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
  }
  geo.computeVertexNormals();
  if (mesh.normals.length > 0) {
    const creased = toCreasedNormals(geo, CREASE_ANGLE_RAD);
    geo.dispose();
    geo = creased;
  }
  return geo;
}

/**
 * Rest geometries share the body's LRU (keyed `sig:rest`) so both age out
 * together when a design re-save mints a new sig.
 */
function restKey(sig: string): string {
  return `${sig}:rest`;
}

function restMeshOf(designMesh: LinkedDesignMesh): MeshData | undefined {
  const restMesh = designMesh.mesh.knifeRestMesh;
  return restMesh && restMesh.vertices.length > 0 ? restMesh : undefined;
}

function getCachedGeometry(
  key: string,
  mesh: MeshData,
  inUse: ReadonlySet<string>
): THREE.BufferGeometry {
  let geometry = designGeometryCache.get(key);
  if (geometry) {
    // LRU: move accessed entry to the end
    designGeometryCache.delete(key);
    designGeometryCache.set(key, geometry);
    return geometry;
  }
  geometry = buildDesignGeometry(mesh);
  evictUnused(MAX_CACHE_SIZE, inUse);
  designGeometryCache.set(key, geometry);
  return geometry;
}

function buildEntry(designMesh: LinkedDesignMesh, inUse: ReadonlySet<string>): DesignGeometryEntry {
  const restMesh = restMeshOf(designMesh);
  let rest: DesignGeometryEntry['rest'];
  if (restMesh) {
    const geometry = getCachedGeometry(restKey(designMesh.sig), restMesh, inUse);
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox;
    if (bb) {
      rest = { geometry, widthMm: bb.max.x - bb.min.x, depthMm: bb.max.y - bb.min.y };
    }
  }
  const { bodyBaseMm } = designMesh;
  return {
    sig: designMesh.sig,
    geometry: getCachedGeometry(designMesh.sig, designMesh.mesh, inUse),
    width: designMesh.width,
    depth: designMesh.depth,
    ...(bodyBaseMm !== undefined
      ? { bodyBaseMm: bodyBaseMm + detachableFeetLiftMm(designMesh.mesh) }
      : {}),
    ...(rest !== undefined ? { rest } : {}),
  };
}

/**
 * Provide each linked bin's BufferGeometry, built lazily per design mesh and
 * shared across every bin that resolves to it (a geometry can be bound to many
 * meshes). Stale geometries (design edited → new sig) age out of the LRU
 * cache; everything is disposed when the preview unmounts.
 */
export function useDesignGeometries(
  designMeshes: Map<BinId, LinkedDesignMesh>
): Map<BinId, DesignGeometryEntry> {
  const { entries, inUse } = useMemo(() => {
    // Every key this build draws is protected before any is built, so a build
    // past the bound evicts only geometries no bin here binds.
    const inUse = new Set<string>();
    for (const designMesh of designMeshes.values()) {
      inUse.add(designMesh.sig);
      if (restMeshOf(designMesh)) inUse.add(restKey(designMesh.sig));
    }
    const map = new Map<BinId, DesignGeometryEntry>();
    const byMesh = new Map<LinkedDesignMesh, DesignGeometryEntry>();
    for (const [id, designMesh] of designMeshes) {
      let entry = byMesh.get(designMesh);
      if (!entry) {
        entry = buildEntry(designMesh, inUse);
        byMesh.set(designMesh, entry);
      }
      map.set(id, entry);
    }
    return { entries: map, inUse };
  }, [designMeshes]);

  useEffect(() => {
    for (const key of inUse) pinGeometry(key);
    return () => {
      for (const key of inUse) unpinGeometry(key);
      scheduleTrim();
    };
  }, [inUse]);

  // Clear the cache when the preview unmounts (e.g. layout switch), matching
  // MergedBinMeshes' clearGeometryCache lifecycle.
  useEffect(() => {
    return () => {
      clearDesignGeometryCache();
    };
  }, []);

  return entries;
}
