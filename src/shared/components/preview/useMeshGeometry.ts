/**
 * Shared hook for building Three.js BufferGeometry from mesh data arrays.
 *
 * Used by both BaseplateMesh (single baseplate) and PieceMesh (split pieces)
 * to avoid duplicating identical geometry construction and disposal logic.
 */

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';

/** Per-face group defining a material index range within the index buffer */
export interface MeshFaceGroup {
  readonly start: number;
  readonly count: number;
  readonly materialIndex: number;
}

interface MeshArrays {
  readonly vertices: Float32Array | null;
  readonly normals: Float32Array | null;
  readonly indices: Uint32Array | null;
  readonly edgeVertices: Float32Array | null;
  /** Optional face groups for multi-material rendering. Each group maps a range of indices to a material index. */
  readonly faceGroups?: readonly MeshFaceGroup[];
}

interface MeshGeometryResult {
  readonly geometry: THREE.BufferGeometry | null;
  readonly edgesGeometry: THREE.BufferGeometry | null;
  readonly hasPrecomputedNormals: boolean;
}

/**
 * Build and manage Three.js BufferGeometry from typed array mesh data.
 * Handles normal computation fallback and automatic disposal.
 */
export function useMeshGeometry(arrays: MeshArrays): MeshGeometryResult {
  const { vertices, normals, indices, edgeVertices, faceGroups } = arrays;
  const hasPrecomputedNormals = normals !== null && normals.length > 0;

  const geometry = useMemo(() => {
    if (!vertices || vertices.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    if (indices && indices.length > 0) {
      geo.setIndex(new THREE.BufferAttribute(indices, 1));
    }

    if (hasPrecomputedNormals) {
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    } else {
      geo.computeVertexNormals();
    }

    // Add material groups for multi-material rendering
    if (faceGroups && faceGroups.length > 0) {
      geo.clearGroups();
      for (const group of faceGroups) {
        geo.addGroup(group.start, group.count, group.materialIndex);
      }
    }

    return geo;
  }, [vertices, normals, indices, hasPrecomputedNormals, faceGroups]);

  const edgesGeometry = useMemo(() => {
    if (!edgeVertices || edgeVertices.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(edgeVertices, 3));
    return geo;
  }, [edgeVertices]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
      edgesGeometry?.dispose();
    };
  }, [geometry, edgesGeometry]);

  return { geometry, edgesGeometry, hasPrecomputedNormals };
}
