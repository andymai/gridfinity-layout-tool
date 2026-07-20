import type * as THREE from 'three';
import { createBinGeometry, type BinDividersSpec } from '@/shared/hooks/useBinGeometry';

/**
 * Geometry cache for reusing identical bin geometries.
 * Key format: "width|depth|height|color|dividerSig"
 * This avoids recreating the same geometry multiple times when bins have identical dimensions.
 * Uses LRU eviction: accessed entries are moved to end, oldest entries evicted first.
 */
const geometryCache = new Map<string, THREE.BufferGeometry>();
const MAX_CACHE_SIZE = 100;

/**
 * Clear all cached geometries and dispose them.
 * Call this when switching layouts to prevent memory accumulation.
 */
export function clearGeometryCache(): void {
  for (const geo of geometryCache.values()) {
    geo.dispose();
  }
  geometryCache.clear();
}

function getCacheKey(
  width: number,
  depth: number,
  height: number,
  color: string,
  dividers?: BinDividersSpec
): string {
  // Round to 2 decimal places to handle floating point precision.
  // Divider sig (designId:updatedAt:gridUnitMm) distinguishes linked-design
  // interiors; bins linked to the same design share one cached geometry.
  return `${width.toFixed(2)}|${depth.toFixed(2)}|${height.toFixed(2)}|${color}|${dividers?.sig ?? ''}`;
}

export function getCachedGeometry(
  width: number,
  depth: number,
  height: number,
  color: string,
  dividers?: BinDividersSpec
): THREE.BufferGeometry {
  const key = getCacheKey(width, depth, height, color, dividers);
  let geo = geometryCache.get(key);

  if (geo) {
    // LRU: Move accessed entry to end by deleting and re-inserting
    geometryCache.delete(key);
    geometryCache.set(key, geo);
  } else {
    geo = createBinGeometry({ width, depth, height, baseColor: color, dividers });
    // Evict oldest (least recently used) entry if cache is full
    if (geometryCache.size >= MAX_CACHE_SIZE) {
      const firstKey = geometryCache.keys().next().value;
      if (firstKey !== undefined) {
        const oldGeo = geometryCache.get(firstKey);
        oldGeo?.dispose();
        geometryCache.delete(firstKey);
      }
    }
    geometryCache.set(key, geo);
  }

  return geo;
}
