import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';

export interface GhostMeshStyle {
  readonly color: string;
  readonly opacity: number;
}

/**
 * Owns the translucent material for a ghost mesh: built alongside the
 * geometry, a frame requested when they appear, and both disposed when the
 * geometry changes or the overlay unmounts.
 */
export function useGhostMeshMaterial(
  geometry: THREE.BufferGeometry | null,
  style: GhostMeshStyle
): THREE.MeshBasicMaterial | null {
  const { invalidate } = useThree();
  const { color, opacity } = style;

  const material = useMemo(() => {
    if (!geometry) return null;
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthTest: true,
    });
  }, [geometry, color, opacity]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
      material?.dispose();
    };
  }, [geometry, material]);

  useEffect(() => {
    if (geometry && material) invalidate();
  }, [geometry, material, invalidate]);

  return material;
}
