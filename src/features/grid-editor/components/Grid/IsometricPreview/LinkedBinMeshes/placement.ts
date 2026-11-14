import type { BinId } from '@/core/types';
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

/** How far the design's mesh turns to stand the way the bin does, in radians. */
export function placementTurnRadians(
  bin: { readonly width: number; readonly depth: number; readonly halfTurned?: boolean },
  designWidth: number,
  designDepth: number
): number {
  const quarter = isRotatedPlacement(bin.width, bin.depth, designWidth, designDepth);
  return (quarter ? Math.PI / 2 : 0) + (bin.halfTurned ? Math.PI : 0);
}

/** Resolve the design geometry for a bin, or undefined for unlinked/unresolved bins. */
export function designEntryFor(
  binData: BinRenderData,
  designGeometries: Map<BinId, DesignGeometryEntry>
): DesignGeometryEntry | undefined {
  return binData.bin.linkedDesignId !== undefined
    ? designGeometries.get(binData.bin.id)
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
  designGeometries: Map<BinId, DesignGeometryEntry>
): { designMeshBins: DesignMeshBin[]; plainBins: BinRenderData[] } {
  const designMeshBins: DesignMeshBin[] = [];
  const plainBins: BinRenderData[] = [];
  for (const binData of bins) {
    const entry = designEntryFor(binData, designGeometries);
    // A rest-role bin renders its design's companion geometry; when the
    // design's mesh predates the rest (stale cache), the stylized box is more
    // honest than drawing the whole block at the rest's footprint.
    if (entry && (binData.bin.pairRole !== 'rest' || entry.rest !== undefined)) {
      designMeshBins.push({ binData, entry });
    } else {
      plainBins.push(binData);
    }
  }
  return { designMeshBins, plainBins };
}
