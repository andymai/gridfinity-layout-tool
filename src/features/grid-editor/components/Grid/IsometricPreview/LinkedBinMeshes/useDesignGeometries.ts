import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { DesignId } from '@/core/types';
import type { MeshData } from '@/shared/types/generation';
import type { LinkedDesignMesh } from '@/shared/hooks/useLinkedDesignMeshes';
import { CREASE_ANGLE_RAD } from '@/shared/constants/tessellation';

/** A ready-to-render design geometry, shared by every bin linked to the design. */
export interface DesignGeometryEntry {
  readonly sig: string;
  readonly geometry: THREE.BufferGeometry;
  /** Design footprint in grid units — detects rotated (w↔d) placement. */
  readonly width: number;
  readonly depth: number;
}

/**
 * Module-level geometry cache keyed by design sig (designId:updatedAt), the
 * same pattern as MergedBinMeshes' geometryCache: LRU eviction with disposal,
 * cleared wholesale when the owning preview unmounts (layout switch).
 */
const designGeometryCache = new Map<string, THREE.BufferGeometry>();
const MAX_CACHE_SIZE = 64;

/** Clear all cached design geometries and dispose them. */
export function clearDesignGeometryCache(): void {
  for (const geometry of designGeometryCache.values()) {
    geometry.dispose();
  }
  designGeometryCache.clear();
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
  // bin's own frame, so concatenating is the whole transform.
  const { vertices, indices } = mergeParts(mesh, mesh.detachableFeetMesh);

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

function getCachedDesignGeometry(designMesh: LinkedDesignMesh): THREE.BufferGeometry {
  let geometry = designGeometryCache.get(designMesh.sig);
  if (geometry) {
    // LRU: move accessed entry to the end
    designGeometryCache.delete(designMesh.sig);
    designGeometryCache.set(designMesh.sig, geometry);
    return geometry;
  }

  geometry = buildDesignGeometry(designMesh.mesh);
  if (designGeometryCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = designGeometryCache.keys().next().value;
    if (oldestKey !== undefined) {
      designGeometryCache.get(oldestKey)?.dispose();
      designGeometryCache.delete(oldestKey);
    }
  }
  designGeometryCache.set(designMesh.sig, geometry);
  return geometry;
}

/**
 * Provide one BufferGeometry per linked design, built lazily and shared
 * across every bin instance linked to that design (a geometry can be bound
 * to many meshes). Stale geometries (design edited → new sig) age out of the
 * LRU cache; everything is disposed when the preview unmounts.
 */
export function useDesignGeometries(
  designMeshes: Map<DesignId, LinkedDesignMesh>
): Map<DesignId, DesignGeometryEntry> {
  const entries = useMemo(() => {
    const map = new Map<DesignId, DesignGeometryEntry>();
    for (const [id, designMesh] of designMeshes) {
      map.set(id, {
        sig: designMesh.sig,
        geometry: getCachedDesignGeometry(designMesh),
        width: designMesh.width,
        depth: designMesh.depth,
      });
    }
    return map;
  }, [designMeshes]);

  // Clear the cache when the preview unmounts (e.g. layout switch), matching
  // MergedBinMeshes' clearGeometryCache lifecycle.
  useEffect(() => {
    return () => {
      clearDesignGeometryCache();
    };
  }, []);

  return entries;
}
