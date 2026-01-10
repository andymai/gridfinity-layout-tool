import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createBinGeometry } from './useBinGeometry';

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
 * Renders bins grouped by color with merged geometries.
 * Reduces draw calls from N bins to ~number of unique colors.
 */
export function MergedBinMeshes({ bins }: MergedBinMeshesProps) {
  // Group bins by color
  const binsByColor = useMemo(() => {
    const groups = new Map<string, BinData[]>();
    for (const bin of bins) {
      const existing = groups.get(bin.color);
      if (existing) {
        existing.push(bin);
      } else {
        groups.set(bin.color, [bin]);
      }
    }
    return groups;
  }, [bins]);

  // Create merged geometry for each color group
  const colorGroups = useMemo(() => {
    const result: Array<{
      color: string;
      geometry: THREE.BufferGeometry;
      opacity: number;
    }> = [];

    for (const [color, colorBins] of binsByColor) {
      if (colorBins.length === 0) continue;

      // Create individual geometries and translate to position
      const geometries: THREE.BufferGeometry[] = [];
      for (const binData of colorBins) {
        const geo = createBinGeometry({
          width: binData.bin.width,
          depth: binData.bin.depth,
          height: binData.height,
          baseColor: color,
        });
        // Translate geometry to bin position
        geo.translate(binData.x, binData.y, binData.z);
        geometries.push(geo);
      }

      // Merge all geometries in this color group
      const merged = mergeGeometries(geometries, false);
      if (merged) {
        // Use the first bin's opacity (assume all same opacity per color group)
        result.push({
          color,
          geometry: merged,
          opacity: colorBins[0].opacity,
        });
      }

      // Dispose individual geometries (merged creates a copy)
      for (const geo of geometries) {
        geo.dispose();
      }
    }

    return result;
  }, [binsByColor]);

  // Cleanup merged geometries on unmount
  useEffect(() => {
    return () => {
      for (const group of colorGroups) {
        group.geometry.dispose();
      }
    };
  }, [colorGroups]);

  if (bins.length === 0) return null;

  return (
    <>
      {colorGroups.map((group) => (
        <mesh key={group.color} geometry={group.geometry}>
          <meshStandardMaterial
            vertexColors
            roughness={0.4}
            metalness={0}
            transparent={group.opacity < 1}
            opacity={group.opacity}
            depthWrite={group.opacity === 1}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </>
  );
}
