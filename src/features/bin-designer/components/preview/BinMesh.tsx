/**
 * Renders generated bin geometry as a Three.js mesh with PBR material.
 * Uses scene lighting (hemisphere + directional) for natural shading
 * with FrontSide face culling for correct visibility.
 *
 * Shows subtle edge lines to indicate this is a fast preview sketch,
 * not the final export quality.
 */

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useShallow } from 'zustand/react/shallow';

/** Edge line color - dark for high contrast */
const EDGE_COLOR = '#1a1a1a';
/** Edge line opacity */
const EDGE_OPACITY = 0.6;

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

  const geometry = useMemo(() => {
    if (!vertices || !normals || vertices.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    return geo;
  }, [vertices, normals]);

  // Create edge geometry for sketch-like appearance
  const edgesGeometry = useMemo(() => {
    if (!geometry) return null;
    // Threshold angle: only show edges where face angle > 30°
    // This highlights the major edges without showing every triangle
    return new THREE.EdgesGeometry(geometry, 30);
  }, [geometry]);

  // Dispose old geometries on unmount or change
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
    <group position={[0, 0, 0.1]}>
      {/* Solid mesh */}
      <mesh geometry={geometry}>
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

      {/* Edge lines for sketch appearance (hidden in wireframe mode) */}
      {!wireframe && edgesGeometry && (
        <lineSegments geometry={edgesGeometry}>
          <lineBasicMaterial
            color={EDGE_COLOR}
            transparent
            opacity={EDGE_OPACITY}
            linewidth={1}
          />
        </lineSegments>
      )}
    </group>
  );
}
