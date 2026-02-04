import { useMemo, useEffect, useDeferredValue, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createBinGeometry } from '@/hooks/useBinGeometry';

interface BinData {
  bin: {
    id: string;
    width: number;
    depth: number;
  };
  x: number;
  y: number;
  z: number;
  height: number;
  color: string;
  opacity: number;
}

interface MergedBinMeshesProps {
  bins: BinData[];
}

/**
 * Geometry cache for reusing identical bin geometries.
 * Key format: "width|depth|height|color"
 * This avoids recreating the same geometry multiple times when bins have identical dimensions.
 */
const geometryCache = new Map<string, THREE.BufferGeometry>();
const MAX_CACHE_SIZE = 100;

function getCacheKey(width: number, depth: number, height: number, color: string): string {
  // Round to 2 decimal places to handle floating point precision
  return `${width.toFixed(2)}|${depth.toFixed(2)}|${height.toFixed(2)}|${color}`;
}

function getCachedGeometry(
  width: number,
  depth: number,
  height: number,
  color: string
): THREE.BufferGeometry {
  const key = getCacheKey(width, depth, height, color);
  let geo = geometryCache.get(key);

  if (!geo) {
    geo = createBinGeometry({ width, depth, height, baseColor: color });
    // Evict oldest entry if cache is full (simple LRU-like behavior)
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

/**
 * Build a single merged geometry for all bins using detailed bin geometry.
 * Creates individual geometries with full detail (open-top, interior, bevels)
 * then merges them into a single draw call.
 * Uses geometry caching to avoid recreating identical bin geometries.
 */
function buildMergedGeometry(bins: BinData[]): THREE.BufferGeometry | null {
  if (bins.length === 0) return null;

  const geometries: THREE.BufferGeometry[] = [];

  for (const binData of bins) {
    // Get cached geometry (or create and cache if not exists)
    const cachedGeo = getCachedGeometry(
      binData.bin.width,
      binData.bin.depth,
      binData.height,
      binData.color
    );

    // Clone the cached geometry so we can translate it without affecting the cache
    const geo = cachedGeo.clone();

    // Translate to bin position
    geo.translate(binData.x, binData.y, binData.z);
    geometries.push(geo);
  }

  // Merge all geometries into single BufferGeometry
  const merged = mergeGeometries(geometries, false);

  // Dispose cloned geometries after merging (cache retains originals)
  for (const geo of geometries) {
    geo.dispose();
  }

  return merged;
}

/**
 * Renders all non-selected bins as a single merged mesh.
 * Optimized for large bin counts by merging all geometries into one draw call
 * while preserving the detailed bin appearance (open-top, interior, bevels).
 *
 * Performance optimizations:
 * 1. useDeferredValue - Allows UI to stay responsive during rapid bin changes
 * 2. Geometry caching - Reuses identical geometries for same-dimension bins
 * 3. Single merged mesh - Reduces draw calls from N to 1
 */
export function MergedBinMeshes({ bins }: MergedBinMeshesProps) {
  // Defer bin updates during rapid changes (e.g., dragging, resizing)
  // This allows the UI to remain responsive while 3D preview catches up
  const deferredBins = useDeferredValue(bins);

  // Track previous geometry for proper cleanup
  const prevGeometryRef = useRef<THREE.BufferGeometry | null>(null);

  // Build merged geometry using deferred bins
  const geometry = useMemo(() => buildMergedGeometry(deferredBins), [deferredBins]);

  // Cleanup previous geometry when a new one is created
  // This ensures we don't leak memory during rapid updates
  useEffect(() => {
    if (prevGeometryRef.current && prevGeometryRef.current !== geometry) {
      prevGeometryRef.current.dispose();
    }
    prevGeometryRef.current = geometry;

    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  if (!geometry || deferredBins.length === 0) return null;

  // Determine opacity (assume uniform for non-selected bins)
  const opacity = deferredBins[0]?.opacity ?? 1;

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        vertexColors
        roughness={0.4}
        metalness={0}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity === 1}
        side={THREE.DoubleSide}
        emissive="#808080"
        emissiveIntensity={0.15}
      />
    </mesh>
  );
}
