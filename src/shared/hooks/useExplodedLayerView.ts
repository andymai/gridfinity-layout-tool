import { useMemo } from 'react';
import type { Bin, Layer, Category, LayerId, DesignId } from '@/core/types';
import { STAGING_ID, DEFAULT_CATEGORY_COLOR } from '@/core/constants';
import { getRestingStack } from '@/shared/utils/restingStack';
import type { BinDividersSpec } from '@/shared/hooks/useBinGeometry';

/** Gap between layers in grid units when exploded. */
const EXPLODE_GAP = 2.5;

/** Opacity for inactive (non-active) layers in exploded mode. */
const EXPLODE_DIM_OPACITY = 0.35;

/** Renderable data for a single bin (matches binsToRender shape in IsometricPreview). */
export interface BinRenderData {
  bin: Bin;
  x: number;
  y: number;
  z: number;
  height: number;
  clearanceHeight: number;
  color: string;
  opacity: number;
  /** Compartment dividers from the bin's linked design, if any. */
  dividers?: BinDividersSpec;
}

/** Per-layer grouping for exploded view rendering. */
export interface LayerRenderGroup {
  layer: Layer;
  /** Lowest resting base among the layer's bins; 0 when it has none. */
  floorZ: number;
  /** Midway between the layer's lowest base and highest top, for its label. */
  labelZ: number;
  explodedZOffset: number;
  bins: BinRenderData[];
  isActive: boolean;
  opacity: number;
}

interface UseExplodedLayerViewOptions {
  bins: Bin[];
  layers: Layer[];
  categories: Category[];
  heightToGridScale: number;
  activeLayerId: LayerId;
  isExplodedView: boolean;
  isExitAnimating?: boolean;
  /** Divider specs for linked designs, keyed by design id. */
  designDividers?: Map<DesignId, BinDividersSpec>;
}

/**
 * Computes per-layer bin groups with Z offsets and opacity for exploded view rendering.
 * Returns null when not in exploded mode (caller should use the normal flat rendering path).
 */
export function useExplodedLayerView({
  bins,
  layers,
  categories,
  heightToGridScale,
  activeLayerId,
  isExplodedView,
  isExitAnimating = false,
  designDividers,
}: UseExplodedLayerViewOptions): LayerRenderGroup[] | null {
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Keep groups mounted during exit animation (offsets → 0) so useFrame can lerp back
  const shouldRender = isExplodedView || isExitAnimating;

  return useMemo(() => {
    if (!shouldRender) return null;

    const layerIndexMap = new Map(layers.map((l, idx) => [l.id, idx]));
    const stack = getRestingStack(bins, layers);

    const groups: LayerRenderGroup[] = layers.map((layer, idx) => {
      const isActive = layer.id === activeLayerId;

      return {
        layer,
        floorZ: 0,
        labelZ: (layer.height * heightToGridScale) / 2,
        explodedZOffset: isExplodedView ? idx * EXPLODE_GAP : 0,
        bins: [],
        isActive,
        opacity: isExplodedView && !isActive ? EXPLODE_DIM_OPACITY : 1,
      };
    });
    const extents = layers.map(() => ({ low: Infinity, high: -Infinity }));

    // Partition bins into their layer groups
    for (const bin of bins) {
      if (bin.layerId === STAGING_ID) continue;

      const layerIdx = layerIndexMap.get(bin.layerId);
      const rest = stack.bins.get(bin.id);
      if (layerIdx === undefined || !rest) continue;

      const group = groups[layerIdx];
      const category = categoryMap.get(bin.category);
      const color = category?.color || DEFAULT_CATEGORY_COLOR;
      const extent = extents[layerIdx];
      extent.low = Math.min(extent.low, rest.zStart);
      extent.high = Math.max(extent.high, rest.zStart + bin.height);

      // Selected bins are handled separately by IsometricPreview (BinMesh with glow).
      // Include them in the group data so the parent can split them out.
      group.bins.push({
        bin,
        x: bin.x,
        y: bin.y,
        z: rest.zStart * heightToGridScale,
        height: bin.height * heightToGridScale,
        clearanceHeight: (bin.clearanceHeight || 0) * heightToGridScale,
        color,
        opacity: group.opacity,
        dividers:
          bin.linkedDesignId !== undefined ? designDividers?.get(bin.linkedDesignId) : undefined,
      });
    }

    groups.forEach((group, idx) => {
      const { low, high } = extents[idx];
      if (low === Infinity) return;
      group.floorZ = low * heightToGridScale;
      group.labelZ = ((low + high) / 2) * heightToGridScale;
    });

    for (const group of groups) {
      group.bins.sort((a, b) => {
        const depthA = a.x - a.y;
        const depthB = b.x - b.y;
        return depthA - depthB;
      });

      for (let i = 0; i < group.bins.length; i++) {
        group.bins[i].z += i * 0.0002;
      }
    }

    return groups;
  }, [
    shouldRender,
    isExplodedView,
    bins,
    layers,
    categoryMap,
    heightToGridScale,
    activeLayerId,
    designDividers,
  ]);
}
