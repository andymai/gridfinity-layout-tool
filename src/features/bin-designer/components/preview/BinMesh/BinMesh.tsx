/**
 * Renders generated bin geometry as a Three.js mesh with PBR material.
 * Uses scene lighting (hemisphere + directional) for natural shading
 * with FrontSide face culling for correct visibility.
 *
 * Features:
 * - Dynamic flat shading for large bins (GPU-computed normals)
 * - Pre-computed BREP edge lines from worker (avoids main-thread EdgesGeometry)
 * - polygonOffset to prevent z-fighting with edge lines
 */

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useShallow } from 'zustand/react/shallow';

/** Edge line color (black for sketch look) */
const EDGE_COLOR = '#000000';

interface BinMeshProps {
  wireframe: boolean;
  /** Base color for the bin (user-selectable) */
  color: string;
}

export function BinMesh({ wireframe, color }: BinMeshProps) {
  const { invalidate } = useThree();
  const { vertices, normals, indices, edgeVertices } = useDesignerStore(
    useShallow((s) => ({
      vertices: s.generation.mesh?.vertices ?? null,
      normals: s.generation.mesh?.normals ?? null,
      indices: s.generation.mesh?.indices ?? null,
      edgeVertices: s.generation.mesh?.edgeVertices ?? null,
    }))
  );

  // Check if we have precomputed normals (small bins/export) or empty (large bins)
  const hasPrecomputedNormals = normals && normals.length > 0;

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
      // Compute normals for flat shading
      geo.computeVertexNormals();
    }

    return geo;
  }, [vertices, normals, indices, hasPrecomputedNormals]);

  // Create edge geometry from pre-computed BREP topology edges (computed in worker)
  const edgesGeometry = useMemo(() => {
    if (!edgeVertices || edgeVertices.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(edgeVertices, 3));
    return geo;
  }, [edgeVertices]);

  // Dispose old geometry on unmount or change
  useEffect(() => {
    return () => {
      geometry?.dispose();
      edgesGeometry?.dispose();
    };
  }, [geometry, edgesGeometry]);

  // Invalidate frame when mesh data changes
  useEffect(() => {
    if (geometry) invalidate();
  }, [geometry, invalidate]);

  // Invalidate frame when visual props change
  useEffect(() => {
    invalidate();
  }, [wireframe, color, invalidate]);

  if (!geometry) return null;

  return (
    <>
      <mesh geometry={geometry} position={[0, 0, 0.1]}>
        <meshStandardMaterial
          color={color}
          roughness={0.45}
          metalness={0}
          wireframe={wireframe}
          side={THREE.DoubleSide}
          emissive={color}
          emissiveIntensity={0.08}
          flatShading={!hasPrecomputedNormals}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      {/* Edge lines from BREP topology (pre-computed in worker) */}
      {!wireframe && edgesGeometry && (
        <lineSegments geometry={edgesGeometry} position={[0, 0, 0.1]} renderOrder={1}>
          <lineBasicMaterial color={EDGE_COLOR} depthTest={true} />
        </lineSegments>
      )}
    </>
  );
}
