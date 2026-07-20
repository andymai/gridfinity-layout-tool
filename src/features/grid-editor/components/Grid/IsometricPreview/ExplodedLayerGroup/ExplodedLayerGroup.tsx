import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Group } from 'three';
import type { DesignId, LayerId } from '@/core/types';
import { MergedBinMeshes } from '../MergedBinMeshes';
import {
  LinkedBinMesh,
  SelectedBin,
  partitionByDesignMesh,
  type DesignGeometryEntry,
} from '../LinkedBinMeshes';
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
  /** Resolved real geometries for linked designs, keyed by design id. */
  designGeometries: Map<DesignId, DesignGeometryEntry>;
  gridUnitMm: number;
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
  designGeometries,
  gridUnitMm,
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

  // Split non-selected bins: linked bins with a resolved design mesh render
  // the real geometry individually; the rest go through the merged-box path.
  const { designMeshBins, plainBins } = useMemo(
    () => partitionByDesignMesh(nonSelectedBins, designGeometries),
    [nonSelectedBins, designGeometries]
  );

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
      <MergedBinMeshes bins={plainBins} />

      {/* Linked bins with a resolved design mesh: real geometry */}
      {designMeshBins.map(({ binData, entry }) => (
        <LinkedBinMesh
          key={`design-${binData.bin.id}`}
          binData={binData}
          entry={entry}
          gridUnitMm={gridUnitMm}
        />
      ))}

      {/* Selected bins: individual meshes for glow animation */}
      {selectedBins.map((binData) => (
        <SelectedBin
          key={binData.bin.id}
          binData={binData}
          designGeometries={designGeometries}
          gridUnitMm={gridUnitMm}
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
