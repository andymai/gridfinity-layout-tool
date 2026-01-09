import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Bin } from '../../../types';
import { useBinGeometry } from './useBinGeometry';

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
export function BinMesh({ x, y, z, bin, color, opacity, height, isSelected = false }: BinMeshProps) {
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
      // Slow sine wave: 0.15 to 0.35 intensity over ~2 seconds
      const pulse = 0.25 + Math.sin(clock.elapsedTime * Math.PI) * 0.1;
      materialRef.current.emissiveIntensity = pulse;
    }
  });

  return (
    <mesh position={[x, y, z]} geometry={geometry}>
      <meshStandardMaterial
        ref={materialRef}
        vertexColors
        roughness={0.7} // Matte plastic finish
        metalness={0}   // Non-metallic
        transparent={opacity < 1 || isSelected}
        opacity={opacity}
        depthWrite={opacity === 1 && !isSelected}
        flatShading={false} // Smooth shading for rounded corners
        side={THREE.DoubleSide} // Fixes clipping from incorrect face winding
        emissive={isSelected ? '#ffffff' : '#000000'}
        emissiveIntensity={isSelected ? 0.25 : 0}
      />
    </mesh>
  );
}
