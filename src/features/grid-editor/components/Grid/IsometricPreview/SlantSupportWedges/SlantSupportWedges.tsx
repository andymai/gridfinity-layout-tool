import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { BinId } from '@/core/types';
import type { BinRenderData } from '@/shared/hooks/useExplodedLayerView';
import type { DesignGeometryEntry } from '../LinkedBinMeshes/useDesignGeometries';
import { slantSupportPlacement, slantSupportWedge } from './slantSupportWedge';

interface SlantSupportWedgesProps {
  bins: readonly BinRenderData[];
  /** Bins drawn from their design's mesh already carry their support. */
  designGeometries: ReadonlyMap<BinId, DesignGeometryEntry>;
}

export function SlantSupportWedges({ bins, designGeometries }: SlantSupportWedgesProps) {
  return (
    <>
      {bins.map((binData) =>
        binData.slantSupport && !designGeometries.has(binData.bin.id) ? (
          <SlantSupportWedge key={`slant-support-${binData.bin.id}`} binData={binData} />
        ) : null
      )}
    </>
  );
}

function SlantSupportWedge({ binData }: { binData: BinRenderData }) {
  const support = binData.slantSupport;
  const placement = support ? slantSupportPlacement(support) : null;
  const length = placement?.length ?? 0;
  const width = placement?.width ?? 0;
  const reach = support?.reach ?? 0;
  const pivot = support?.pivot ?? 0;
  const top = support?.top ?? 0;
  const geometry = useMemo(
    () => slantSupportWedge(length, width, reach, pivot, top),
    [length, width, reach, pivot, top]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  if (!placement) return null;

  return (
    <group
      position={[placement.position[0], placement.position[1], binData.z]}
      rotation={[0, 0, placement.turn]}
    >
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={binData.color}
          roughness={0.4}
          metalness={0}
          transparent={binData.opacity < 1}
          opacity={binData.opacity}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
