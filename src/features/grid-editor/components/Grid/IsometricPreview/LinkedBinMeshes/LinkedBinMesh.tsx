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
  const isRest = bin.pairRole === 'rest' && entry.rest !== undefined;
  // Rest mesh extents carry the 0.5mm body clearance; snap to the half-unit
  // grid or the rotation comparison (epsilon 1e-6) can never match.
  const toHalfUnits = (mm: number): number => Math.round((mm / gridUnitMm) * 2) / 2;
  const designW = isRest && entry.rest ? toHalfUnits(entry.rest.widthMm) : entry.width;
  const designD = isRest && entry.rest ? toHalfUnits(entry.rest.depthMm) : entry.depth;
  const rotated = isRotatedPlacement(bin.width, bin.depth, designW, designD);
  const geometry = isRest && entry.rest ? entry.rest.geometry : entry.geometry;

  return (
    <group
      position={[binData.x + bin.width / 2, binData.y + bin.depth / 2, binData.z]}
      rotation={[0, 0, rotated ? Math.PI / 2 : 0]}
      scale={[scale, scale, scale]}
    >
      <mesh geometry={geometry}>
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
