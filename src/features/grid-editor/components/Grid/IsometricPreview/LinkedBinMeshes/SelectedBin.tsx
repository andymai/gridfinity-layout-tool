import type { DesignId } from '@/core/types';
import type { BinRenderData } from '@/shared/hooks/useExplodedLayerView';
import { BinMesh } from '../BinMesh';
import { LinkedBinMesh } from './LinkedBinMesh';
import { designEntryFor } from './placement';
import type { DesignGeometryEntry } from './useDesignGeometries';

interface SelectedBinProps {
  binData: BinRenderData;
  designGeometries: Map<DesignId, DesignGeometryEntry>;
  gridUnitMm: number;
}

/**
 * A selected bin with glow: renders the linked design's real mesh when it is
 * resolved, otherwise the stylized box (with divider fallback).
 */
export function SelectedBin({ binData, designGeometries, gridUnitMm }: SelectedBinProps) {
  const entry = designEntryFor(binData, designGeometries);
  return entry ? (
    <LinkedBinMesh binData={binData} entry={entry} gridUnitMm={gridUnitMm} isSelected={true} />
  ) : (
    <BinMesh
      bin={binData.bin}
      x={binData.x}
      y={binData.y}
      z={binData.z}
      height={binData.height}
      color={binData.color}
      opacity={binData.opacity}
      isSelected={true}
      dividers={binData.dividers}
    />
  );
}
