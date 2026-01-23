/**
 * Renders generated bin geometry as a Three.js mesh.
 * Takes raw Float32Array vertex/normal buffers from the generation engine.
 */

import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useShallow } from 'zustand/react/shallow';

interface BinMeshProps {
  wireframe: boolean;
  highContrast?: boolean;
}

export function BinMesh({ wireframe, highContrast = false }: BinMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);

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
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial
        color={highContrast ? '#ffffff' : '#e5e7eb'}
        roughness={highContrast ? 0.3 : 0.5}
        metalness={highContrast ? 0.1 : 0}
        wireframe={wireframe}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
