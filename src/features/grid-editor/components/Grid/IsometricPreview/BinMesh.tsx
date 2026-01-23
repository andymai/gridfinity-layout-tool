import { memo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Bin } from '@/core/types';
import { useBinGeometry } from '@/hooks/useBinGeometry';

interface BinMeshProps {
  bin: Bin;
  color: string;
  opacity: number;
  x: number;
  y: number;
  z: number;
  height: number;
  isSelected?: boolean;
}

/**
 * Bin mesh with custom open-top geometry and per-face vertex colors.
 * Uses world-space lighting for realistic shadows and highlights.
 * Includes rounded corners for polished appearance.
 */
export const BinMesh = memo(function BinMesh({
  x,
  y,
  z,
  bin,
  color,
  opacity,
  height,
  isSelected = false,
}: BinMeshProps) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  const geometry = useBinGeometry({
    width: bin.width,
    depth: bin.depth,
    height,
    baseColor: color,
  });

  // Animate emissive intensity for selected bins (slow pulse)
  useFrame(({ clock }) => {
    if (materialRef.current && isSelected) {
      // Slow sine wave: 0.3 to 0.5 intensity over ~2 seconds
      const pulse = 0.4 + Math.sin(clock.elapsedTime * Math.PI) * 0.1;
      materialRef.current.emissiveIntensity = pulse;
    }
  });

  return (
    <mesh position={[x, y, z]} geometry={geometry}>
      <meshStandardMaterial
        ref={materialRef}
        vertexColors
        roughness={0.4} // Smoother finish for vibrant colors
        metalness={0} // Non-metallic
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity === 1}
        flatShading={false} // Smooth shading for rounded corners
        side={THREE.DoubleSide} // Fixes clipping from incorrect face winding
        emissive={color}
        emissiveIntensity={isSelected ? 0.4 : 0.2}
      />
    </mesh>
  );
});
