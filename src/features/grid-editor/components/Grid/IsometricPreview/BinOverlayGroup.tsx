import type { BinRenderData } from '@/shared/hooks/useExplodedLayerView';
import { orientBedCapacityForBin } from '@/core/constants';
import { SplitLineOverlay } from './SplitLineOverlay';

interface BinOverlayGroupProps {
  binData: BinRenderData;
  maxGridUnits: { width: number; depth: number };
}

/**
 * Per-bin overlay group: clearance height visualization mesh
 * and split line overlay for oversized bins.
 */
export function BinOverlayGroup({ binData, maxGridUnits }: BinOverlayGroupProps) {
  const bedForBin = orientBedCapacityForBin(binData.bin.width, binData.bin.depth, maxGridUnits);
  return (
    <group>
      {/* Clearance zone visualization - translucent box above bin */}
      {binData.clearanceHeight > 0 && (
        <mesh
          position={[
            binData.x + binData.bin.width / 2,
            binData.y + binData.bin.depth / 2,
            binData.z + binData.height + binData.clearanceHeight / 2,
          ]}
        >
          <boxGeometry
            args={[binData.bin.width - 0.05, binData.bin.depth - 0.05, binData.clearanceHeight]}
          />
          <meshStandardMaterial
            color="#ff6b6b"
            transparent
            opacity={0.25 * binData.opacity}
            depthWrite={false}
          />
        </mesh>
      )}
      {/* Split lines for oversized bins */}
      {(binData.bin.width > bedForBin.width || binData.bin.depth > bedForBin.depth) && (
        <SplitLineOverlay
          x={binData.x}
          y={binData.y}
          z={binData.z}
          width={binData.bin.width}
          depth={binData.bin.depth}
          height={binData.height}
          maxGridUnits={bedForBin}
          opacity={binData.opacity}
        />
      )}
    </group>
  );
}
