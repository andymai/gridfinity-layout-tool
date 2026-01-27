/**
 * Renders generated bin geometry as a Three.js mesh with PBR material.
 * Uses scene lighting (hemisphere + directional) for natural shading
 * with FrontSide face culling for correct visibility.
 *
 * Dynamic quality based on bin size:
 * - Small bins (< 4x4): smooth shading with pre-computed normals
 * - Large bins (>= 4x4): flat shading for faster generation
 * Edge lines shown for all sizes for sketch-like appearance.
 */

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useShallow } from 'zustand/react/shallow';

/** Edge line color - black for maximum contrast */
const EDGE_COLOR = '#000000';
/** Edge line width in pixels */
const EDGE_WIDTH = 1.5;

interface BinMeshProps {
  wireframe: boolean;
  /** Base color for the bin (user-selectable) */
  color: string;
}

export function BinMesh({ wireframe, color }: BinMeshProps) {
  const { invalidate } = useThree();
  const { vertices, normals } = useDesignerStore(
    useShallow((s) => ({
      vertices: s.generation.mesh?.vertices ?? null,
      normals: s.generation.mesh?.normals ?? null,
    }))
  );

  // Track if we have smooth normals (small bins) vs flat shading (large bins)
  const hasPrecomputedNormals = normals && normals.length > 0;

  const geometry = useMemo(() => {
    if (!vertices || vertices.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    // Small bins: use pre-computed smooth normals
    // Large bins: compute vertex normals for flat shading fallback
    if (hasPrecomputedNormals) {
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    } else {
      geo.computeVertexNormals();
    }
    return geo;
  }, [vertices, normals, hasPrecomputedNormals]);

  // Dispose old geometry on unmount or change
  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

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
    <group position={[0, 0, 0.1]}>
      {/* Dynamic shading based on bin size:
          - Small bins: smooth shading (pre-computed normals)
          - Large bins: flat shading (sketch look) */}
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={color}
          roughness={0.45}
          metalness={0}
          wireframe={wireframe}
          flatShading={!hasPrecomputedNormals}
          side={THREE.DoubleSide}
          emissive={color}
          emissiveIntensity={0.08}
        />
        {/* Thick edge lines for sketch appearance (hidden in wireframe mode)
            Lower threshold (15°) shows edges on rounded corners */}
        {!wireframe && (
          <Edges threshold={15} color={EDGE_COLOR} lineWidth={EDGE_WIDTH} />
        )}
      </mesh>
    </group>
  );
}
