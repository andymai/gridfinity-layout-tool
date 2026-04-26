/**
 * Shared hook for building Three.js BufferGeometry from mesh data arrays.
 *
 * Used by both BaseplateMesh (single baseplate) and PieceMesh (split pieces)
 * to avoid duplicating identical geometry construction and disposal logic.
 */

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CoarseLODData } from '@/shared/types/generation';

/**
 * Crease angle threshold (radians). Edges where adjacent face normals differ
 * by more than this angle get sharp (split) normals; smoother transitions are
 * interpolated. 35° catches the lip chamfer edges (~45°) while preserving
 * smooth shading on gentle curves like scoop ramps and fillets.
 */
const CREASE_ANGLE = (35 * Math.PI) / 180;

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
 *
 * When OCCT normals are provided, applies crease-angle-aware normal splitting
 * so sharp BREP edges (lip chamfer, wall junctions) get distinct normals per
 * face while smooth surfaces (scoops, fillets) keep interpolated shading.
 */
export function useMeshGeometry(arrays: MeshArrays): MeshGeometryResult {
  const { vertices, normals, indices, edgeVertices, faceGroups } = arrays;
  const hasPrecomputedNormals = normals !== null && normals.length > 0;

  const geometry = useMemo(() => {
    if (!vertices || vertices.length === 0) return null;

    let geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    if (indices && indices.length > 0) {
      geo.setIndex(new THREE.BufferAttribute(indices, 1));
    }

    if (hasPrecomputedNormals) {
      // Use crease-angle splitting: smooth normals on gentle curves but sharp
      // normals at BREP edges where face normals diverge (e.g. lip chamfer).
      // toCreasedNormals converts to non-indexed internally.
      geo.computeVertexNormals();
      const creased = toCreasedNormals(geo, CREASE_ANGLE);
      geo.dispose();
      geo = creased;
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
  }, [vertices, indices, hasPrecomputedNormals, faceGroups]);

  const edgesGeometry = useMemo(() => {
    // Precomputed edges from BREP win — they're authored from analytic curves
    // and exactly represent the model's silhouette/feature lines.
    if (edgeVertices && edgeVertices.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(edgeVertices, 3));
      return geo;
    }
    // Direct-mesh fallback: derive edges from the assembled geometry using the
    // same crease angle that drove normal splitting. EdgesGeometry walks every
    // triangle pair and emits the shared edge wherever the dihedral exceeds
    // the threshold — i.e. exactly the creases that survived `toCreasedNormals`.
    // This gives the direct-mesh preview crisp BREP-style outlines without
    // requiring the generator to author edge geometry by hand.
    if (!geometry) return null;
    const CREASE_ANGLE_DEGREES = 35;
    return new THREE.EdgesGeometry(geometry, CREASE_ANGLE_DEGREES);
  }, [edgeVertices, geometry]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
      edgesGeometry?.dispose();
    };
  }, [geometry, edgesGeometry]);

  return { geometry, edgesGeometry, hasPrecomputedNormals };
}

/**
 * Build a coarse LOD geometry from raw mesh arrays.
 * Simpler than useMeshGeometry — no crease normals or face groups.
 */
export function useCoarseGeometry(
  coarseLOD: CoarseLODData | null | undefined
): THREE.BufferGeometry | null {
  const geometry = useMemo(() => {
    if (!coarseLOD || coarseLOD.vertices.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(coarseLOD.vertices, 3));
    if (coarseLOD.indices.length > 0) {
      geo.setIndex(new THREE.BufferAttribute(coarseLOD.indices, 1));
    }
    geo.computeVertexNormals();
    return geo;
  }, [coarseLOD]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  return geometry;
}
