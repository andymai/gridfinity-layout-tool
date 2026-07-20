import { memo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { BinRenderData } from '@/shared/hooks/useExplodedLayerView';
import type { DesignGeometryEntry } from './useDesignGeometries';
import { isRotatedPlacement } from './placement';

interface LinkedBinMeshProps {
  binData: BinRenderData;
  entry: DesignGeometryEntry;
  /** Layout grid unit in mm — scales the mm-space design mesh to grid units. */
  gridUnitMm: number;
  isSelected?: boolean;
}

/**
 * Renders a linked design's REAL generated mesh at a bin's layout position.
 * The design mesh is in mm, XY-centered on the origin with Z=0 at the bottom;
 * the group translates it to the bin center and scales mm → grid units.
 * The shared geometry comes from useDesignGeometries — never disposed here.
 */
export const LinkedBinMesh = memo(function LinkedBinMesh({
  binData,
  entry,
  gridUnitMm,
  isSelected = false,
}: LinkedBinMeshProps) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  // Selection glow pulse — matches BinMesh's animation.
  useFrame(({ clock }) => {
    if (materialRef.current && isSelected) {
      const pulse = 0.4 + Math.sin(clock.elapsedTime * Math.PI) * 0.1;
      materialRef.current.emissiveIntensity = pulse;
    }
  });

  const { bin } = binData;
  const scale = 1 / gridUnitMm;
  const rotated = isRotatedPlacement(bin.width, bin.depth, entry.width, entry.depth);

  return (
    <group
      position={[binData.x + bin.width / 2, binData.y + bin.depth / 2, binData.z]}
      rotation={[0, 0, rotated ? Math.PI / 2 : 0]}
      scale={[scale, scale, scale]}
    >
      <mesh geometry={entry.geometry}>
        <meshStandardMaterial
          ref={materialRef}
          color={binData.color}
          roughness={0.4}
          metalness={0}
          transparent={binData.opacity < 1}
          opacity={binData.opacity}
          depthWrite={binData.opacity === 1}
          flatShading={false}
          side={THREE.DoubleSide}
          emissive={binData.color}
          emissiveIntensity={isSelected ? 0.4 : 0.2}
        />
      </mesh>
    </group>
  );
});
