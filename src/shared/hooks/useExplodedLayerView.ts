import { useMemo } from 'react';
import type { Bin, Layer, Category, LayerId } from '@/core/types';
import { STAGING_ID, DEFAULT_CATEGORY_COLOR } from '@/core/constants';
import { getLayerZStartResult } from '@/shared/utils/collision';
import { isOk } from '@/core/result';

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
}

/** Per-layer grouping for exploded view rendering. */
export interface LayerRenderGroup {
  layer: Layer;
  baseZ: number;
  explodedZOffset: number;
  bins: BinRenderData[];
  isActive: boolean;
  opacity: number;
  labelHeightMm: number;
}

interface UseExplodedLayerViewOptions {
  bins: Bin[];
  layers: Layer[];
  categories: Category[];
  heightToGridScale: number;
  heightUnitMm: number;
  activeLayerId: LayerId;
  isExplodedView: boolean;
  isExitAnimating?: boolean;
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
  heightUnitMm,
  activeLayerId,
  isExplodedView,
  isExitAnimating = false,
}: UseExplodedLayerViewOptions): LayerRenderGroup[] | null {
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Keep groups mounted during exit animation (offsets → 0) so useFrame can lerp back
  const shouldRender = isExplodedView || isExitAnimating;

  return useMemo(() => {
    if (!shouldRender) return null;

    const layerIndexMap = new Map(layers.map((l, idx) => [l.id, idx]));

    const groups: LayerRenderGroup[] = layers.map((layer, idx) => {
      const zStartResult = getLayerZStartResult(layer.id, layers);
      const baseZ = isOk(zStartResult) ? zStartResult.value * heightToGridScale : 0;
      const isActive = layer.id === activeLayerId;

      return {
        layer,
        baseZ,
        explodedZOffset: isExplodedView ? idx * EXPLODE_GAP : 0,
        bins: [],
        isActive,
        opacity: isExplodedView && !isActive ? EXPLODE_DIM_OPACITY : 1,
        labelHeightMm: layer.height * heightUnitMm,
      };
    });

    // Partition bins into their layer groups
    for (const bin of bins) {
      if (bin.layerId === STAGING_ID) continue;

      const layerIdx = layerIndexMap.get(bin.layerId);
      if (layerIdx === undefined) continue;

      const group = groups[layerIdx];
      const category = categoryMap.get(bin.category);
      const color = category?.color || DEFAULT_CATEGORY_COLOR;

      // Selected bins are handled separately by IsometricPreview (BinMesh with glow).
      // Include them in the group data so the parent can split them out.
      group.bins.push({
        bin,
        x: bin.x,
        y: bin.y,
        z: group.baseZ,
        height: bin.height * heightToGridScale,
        clearanceHeight: (bin.clearanceHeight || 0) * heightToGridScale,
        color,
        opacity: group.opacity,
      });
    }

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
    heightUnitMm,
    activeLayerId,
  ]);
}
