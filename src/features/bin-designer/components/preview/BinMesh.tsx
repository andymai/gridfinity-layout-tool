/**
 * Renders generated bin geometry as a Three.js mesh with PBR material.
 * Uses scene lighting (hemisphere + directional) for natural shading
 * with FrontSide face culling for correct visibility.
 */

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useShallow } from 'zustand/react/shallow';

interface BinMeshProps {
  wireframe: boolean;
  /** Base color for the bin (user-selectable) */
  color: string;
}

export function BinMesh({ wireframe, color }: BinMeshProps) {
  const { vertices, normals } = useDesignerStore(
    useShallow((s) => ({
      vertices: s.generation.mesh?.vertices ?? null,
      normals: s.generation.mesh?.normals ?? null,
    }))
  );

  const geometry = useMemo(() => {
    if (!vertices || !normals || vertices.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    return geo;
  }, [vertices, normals]);

  // Dispose old geometry on unmount or change
  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} position={[0, 0, 0.1]}>
      <meshStandardMaterial
        color={color}
        roughness={0.45}
        metalness={0}
        wireframe={wireframe}
        side={THREE.DoubleSide}
        emissive={color}
        emissiveIntensity={0.08}
      />
    </mesh>
  );
}
