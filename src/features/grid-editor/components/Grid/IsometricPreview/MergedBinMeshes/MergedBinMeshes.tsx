import { useMemo, useEffect, useDeferredValue, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clearGeometryCache, getCachedGeometry } from './geometryCache';

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
      // Clear ref on unmount to prevent double-disposal if component remounts
      if (prevGeometryRef.current) {
        prevGeometryRef.current.dispose();
        prevGeometryRef.current = null;
      }
    };
  }, [geometry]);

  // Clear geometry cache when component unmounts (e.g., layout switch)
  // This prevents memory accumulation across layout changes
  useEffect(() => {
    return () => {
      clearGeometryCache();
    };
  }, []);

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
