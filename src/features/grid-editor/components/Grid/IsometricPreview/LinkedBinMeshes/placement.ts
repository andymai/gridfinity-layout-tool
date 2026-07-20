import type { DesignId } from '@/core/types';
import type { BinRenderData } from '@/shared/hooks/useExplodedLayerView';
import type { DesignGeometryEntry } from './useDesignGeometries';

const DIMENSION_EPSILON = 1e-6;

/**
 * True when the bin is placed rotated 90° relative to its linked design
 * (width and depth swapped). Square footprints never rotate.
 */
export function isRotatedPlacement(
  binWidth: number,
  binDepth: number,
  designWidth: number,
  designDepth: number
): boolean {
  return (
    Math.abs(designWidth - designDepth) > DIMENSION_EPSILON &&
    Math.abs(binWidth - designDepth) < DIMENSION_EPSILON &&
    Math.abs(binDepth - designWidth) < DIMENSION_EPSILON
  );
}

/** Resolve the design geometry for a bin, or undefined for unlinked/unresolved bins. */
export function designEntryFor(
  binData: BinRenderData,
  designGeometries: Map<DesignId, DesignGeometryEntry>
): DesignGeometryEntry | undefined {
  return binData.bin.linkedDesignId !== undefined
    ? designGeometries.get(binData.bin.linkedDesignId)
    : undefined;
}

/** A bin paired with its resolved design geometry. */
export interface DesignMeshBin {
  binData: BinRenderData;
  entry: DesignGeometryEntry;
}

/**
 * Split bins into those with a resolved design mesh (rendered individually as
 * real geometry) and the rest (rendered through the merged stylized-box path).
 */
export function partitionByDesignMesh(
  bins: BinRenderData[],
  designGeometries: Map<DesignId, DesignGeometryEntry>
): { designMeshBins: DesignMeshBin[]; plainBins: BinRenderData[] } {
  const designMeshBins: DesignMeshBin[] = [];
  const plainBins: BinRenderData[] = [];
  for (const binData of bins) {
    const entry = designEntryFor(binData, designGeometries);
    if (entry) {
      designMeshBins.push({ binData, entry });
    } else {
      plainBins.push(binData);
    }
  }
  return { designMeshBins, plainBins };
}
