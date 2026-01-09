import * as THREE from 'three';
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
  const geometry = useBinGeometry({
    width: bin.width,
    depth: bin.depth,
    height,
    baseColor: color,
  });

  return (
    <mesh position={[x, y, z]} geometry={geometry}>
      <meshStandardMaterial
        vertexColors
        roughness={0.7} // Matte plastic finish
        metalness={0}   // Non-metallic
        transparent={opacity < 1 || isSelected}
        opacity={opacity}
        depthWrite={opacity === 1 && !isSelected}
        flatShading={false} // Smooth shading for rounded corners
        side={THREE.DoubleSide} // Fixes clipping from incorrect face winding
        emissive={isSelected ? '#ffffff' : '#000000'}
        emissiveIntensity={isSelected ? 0.3 : 0}
      />
    </mesh>
  );
}
