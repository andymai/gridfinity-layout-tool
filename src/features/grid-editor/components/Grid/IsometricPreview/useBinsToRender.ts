import { useMemo } from 'react';
import type { Bin, Layer, Category, DesignId } from '@/core/types';
import type { LayerViewMode } from '@/core/store/view';
import type { BinRenderData } from '@/shared/hooks/useExplodedLayerView';
import type { BinDividersSpec } from '@/shared/hooks/useBinGeometry';
import { STAGING_ID, DEFAULT_CATEGORY_COLOR } from '@/core/constants';
import { getLayerZStartResult } from '@/shared/utils/collision';
import { isOk } from '@/core/result';

interface UseBinsToRenderOptions {
  bins: Bin[];
  layers: Layer[];
  categories: Category[];
  activeLayerIndex: number;
  layerViewMode: LayerViewMode;
  heightToGridScale: number;
  /** Divider specs for linked designs, keyed by design id. */
  designDividers?: Map<DesignId, BinDividersSpec>;
}

/**
 * Transforms layout bins into renderable format with layer filtering,
 * z-sorting by camera distance, and z-offset for z-fighting prevention.
 */
export function useBinsToRender({
  bins,
  layers,
  categories,
  activeLayerIndex,
  layerViewMode,
  heightToGridScale,
  designDividers,
}: UseBinsToRenderOptions): BinRenderData[] {
  // Performance: Create O(1) lookup maps to avoid O(n^2) .findIndex()/.find() calls in render loop
  const layerIndexMap = useMemo(() => new Map(layers.map((l, idx) => [l.id, idx])), [layers]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  return useMemo(() => {
    const result: BinRenderData[] = [];

    for (const bin of bins) {
      if (bin.layerId === STAGING_ID) continue;

      // Filter bins based on layer view mode (O(1) lookup instead of O(n) findIndex)
      if (activeLayerIndex >= 0) {
        const binLayerIndex = layerIndexMap.get(bin.layerId) ?? -1;

        switch (layerViewMode) {
          case 'focus':
            // Show only the active layer
            if (binLayerIndex !== activeLayerIndex) continue;
            break;
          case 'stack':
            // Show active layer and layers below (slice view)
            if (binLayerIndex > activeLayerIndex) continue;
            break;
          case 'all':
            // Show all layers
            break;
        }
      }

      const zStartResult = getLayerZStartResult(bin.layerId, layers);
      if (!isOk(zStartResult)) continue;
      const zStart = zStartResult.value * heightToGridScale;
      const category = categoryMap.get(bin.category);
      const color = category?.color || DEFAULT_CATEGORY_COLOR;

      result.push({
        bin,
        x: bin.x,
        y: bin.y,
        z: zStart,
        height: bin.height * heightToGridScale,
        clearanceHeight: (bin.clearanceHeight || 0) * heightToGridScale,
        color,
        opacity: 1,
        dividers:
          bin.linkedDesignId !== undefined ? designDividers?.get(bin.linkedDesignId) : undefined,
      });
    }

    // Sort bins for correct depth ordering with camera at front-right viewing toward center
    // Camera is at: (centerX + dist, centerY - dist, centerZ + dist) = (X+, Y-, Z+)
    // Distance from camera increases as X decreases and Y increases
    // So depth = (x - y): low value = far, high value = close
    result.sort((a, b) => {
      // Layer depth (z) is primary
      if (a.z !== b.z) {
        return a.z - b.z;
      }

      // Within same layer, sort by distance from camera
      // Camera at (X+, Y-) means close bins have high (x-y), far bins have low (x-y)
      // Sort ascending (x-y) to render far bins first (with low z-offsets)
      const depthA = a.x - a.y;
      const depthB = b.x - b.y;

      return depthA - depthB;
    });

    // Add tiny z-offsets to prevent z-fighting on coplanar surfaces
    // 0.0002 grid units per bin (~0.0084mm when gridUnitMm=42) - imperceptible but prevents flickering
    result.forEach((binData, index) => {
      binData.z += index * 0.0002;
    });

    return result;
  }, [
    bins,
    layers,
    categoryMap,
    layerIndexMap,
    activeLayerIndex,
    layerViewMode,
    heightToGridScale,
    designDividers,
  ]);
}
