import { useMemo, useEffect } from 'react';
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
 * Build a single merged geometry for all bins using detailed bin geometry.
 * Creates individual geometries with full detail (open-top, interior, bevels)
 * then merges them into a single draw call.
 */
function buildMergedGeometry(bins: BinData[]): THREE.BufferGeometry | null {
  if (bins.length === 0) return null;

  const geometries: THREE.BufferGeometry[] = [];

  for (const binData of bins) {
    // Create detailed bin geometry (open-top with interior cavity)
    const geo = createBinGeometry({
      width: binData.bin.width,
      depth: binData.bin.depth,
      height: binData.height,
      baseColor: binData.color,
    });

    // Translate to bin position
    geo.translate(binData.x, binData.y, binData.z);
    geometries.push(geo);
  }

  // Merge all geometries into single BufferGeometry
  const merged = mergeGeometries(geometries, false);

  // Dispose individual geometries after merging
  for (const geo of geometries) {
    geo.dispose();
  }

  return merged;
}

/**
 * Renders all non-selected bins as a single merged mesh.
 * Optimized for large bin counts by merging all geometries into one draw call
 * while preserving the detailed bin appearance (open-top, interior, bevels).
 */
export function MergedBinMeshes({ bins }: MergedBinMeshesProps) {
  // Build merged geometry for all bins
  const geometry = useMemo(() => buildMergedGeometry(bins), [bins]);

  // Cleanup geometry on change or unmount.
  // When `geometry` changes: cleanup disposes the previous value, new effect captures the new one.
  // On unmount: cleanup disposes the current geometry.
  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  if (!geometry || bins.length === 0) return null;

  // Determine opacity (assume uniform for non-selected bins)
  const opacity = bins[0]?.opacity ?? 1;

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
