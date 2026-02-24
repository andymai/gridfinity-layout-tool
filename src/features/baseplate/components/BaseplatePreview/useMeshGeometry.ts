/**
 * Shared hook for building Three.js BufferGeometry from mesh data arrays.
 *
 * Used by both BaseplateMesh (single baseplate) and PieceMesh (split pieces)
 * to avoid duplicating identical geometry construction and disposal logic.
 */

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';

interface MeshArrays {
  readonly vertices: Float32Array | null;
  readonly normals: Float32Array | null;
  readonly indices: Uint32Array | null;
  readonly edgeVertices: Float32Array | null;
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
  const { vertices, normals, indices, edgeVertices } = arrays;
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

    return geo;
  }, [vertices, normals, indices, hasPrecomputedNormals]);

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
