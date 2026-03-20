import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Group } from 'three';
import type { LayerId } from '@/core/types';
import { MergedBinMeshes } from '../MergedBinMeshes';
import { BinMesh } from '../BinMesh';
import { LayerLabel } from './LayerLabel';
import { lerpStep } from './lerpStep';
import type { BinRenderData } from '@/shared/hooks/useExplodedLayerView';

/** Opacity of the per-layer floor plane. */
const FLOOR_OPACITY = 0.06;

/** Active layer floor is slightly more visible. */
const FLOOR_OPACITY_ACTIVE = 0.1;

interface ExplodedLayerGroupProps {
  layerId: LayerId;
  layerName: string;
  layerHeightMm: number;
  nonSelectedBins: BinRenderData[];
  selectedBins: BinRenderData[];
  explodedZOffset: number;
  isActive: boolean;
  drawerWidth: number;
  drawerDepth: number;
  layerCenterZ: number;
  showChrome: boolean;
  onLayerClick: (layerId: LayerId) => void;
}

/**
 * Renders all bins for a single layer in the exploded 3D view.
 * Manages a spring-like Z offset animation via useFrame (exponential lerp).
 * Includes a translucent floor plane, HTML label overlay, and onClick for layer selection.
 */
export function ExplodedLayerGroup({
  layerId,
  layerName,
  layerHeightMm,
  nonSelectedBins,
  selectedBins,
  explodedZOffset,
  isActive,
  drawerWidth,
  drawerDepth,
  layerCenterZ,
  showChrome,
  onLayerClick,
}: ExplodedLayerGroupProps) {
  const groupRef = useRef<Group>(null);
  const currentZRef = useRef(0);

  useFrame((_, delta) => {
    const newZ = lerpStep(currentZRef.current, explodedZOffset, delta);
    if (newZ === null) return;
    currentZRef.current = newZ;
    if (groupRef.current) {
      groupRef.current.position.z = newZ;
    }
  });

  return (
    <group
      ref={groupRef}
      onClick={(e) => {
        e.stopPropagation();
        onLayerClick(layerId);
      }}
    >
      {/* Translucent floor plane — anchors each layer visually in space */}
      {showChrome && (
        <mesh position={[drawerWidth / 2, drawerDepth / 2, 0.005]}>
          <planeGeometry args={[drawerWidth, drawerDepth]} />
          <meshBasicMaterial
            color={isActive ? '#f59e0b' : '#ffffff'}
            transparent
            opacity={isActive ? FLOOR_OPACITY_ACTIVE : FLOOR_OPACITY}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Non-selected bins: merged for performance */}
      <MergedBinMeshes bins={nonSelectedBins} />

      {/* Selected bins: individual meshes for glow animation */}
      {selectedBins.map((binData) => (
        <BinMesh
          key={binData.bin.id}
          bin={binData.bin}
          x={binData.x}
          y={binData.y}
          z={binData.z}
          height={binData.height}
          color={binData.color}
          opacity={binData.opacity}
          isSelected={true}
        />
      ))}

      {/* Floating label — hidden during exit animation to avoid overlap */}
      {showChrome && (
        <LayerLabel
          layerId={layerId}
          layerName={layerName}
          layerHeightMm={layerHeightMm}
          isActive={isActive}
          drawerWidth={drawerWidth}
          layerCenterZ={layerCenterZ}
          onLayerClick={onLayerClick}
        />
      )}
    </group>
  );
}
