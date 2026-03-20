import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';

// L-shaped marker arm length
const MARKER_SIZE = 0.12;
const LINE_OPACITY = 0.4;

interface BinData {
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  opacity: number;
}

interface BatchedCornerMarkersProps {
  bins: BinData[];
}

/**
 * Batched corner markers for all bins in a single geometry.
 * Reduces 200 draw calls to 1 by combining all line segments.
 */
export function BatchedCornerMarkers({ bins }: BatchedCornerMarkersProps) {
  const colors = useThreeColors();
  const geometry = useMemo(() => {
    const positions: number[] = [];

    for (const bin of bins) {
      const { x, y, z, width, depth, height } = bin;

      // Corner definitions: position relative to bin origin, and 3 direction vectors
      const corners = [
        // Bottom corners (z = 0)
        {
          pos: [0, 0, 0],
          dirs: [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
          ],
        },
        {
          pos: [width, 0, 0],
          dirs: [
            [-1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
          ],
        },
        {
          pos: [width, depth, 0],
          dirs: [
            [-1, 0, 0],
            [0, -1, 0],
            [0, 0, 1],
          ],
        },
        {
          pos: [0, depth, 0],
          dirs: [
            [1, 0, 0],
            [0, -1, 0],
            [0, 0, 1],
          ],
        },
        // Top corners (z = height)
        {
          pos: [0, 0, height],
          dirs: [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, -1],
          ],
        },
        {
          pos: [width, 0, height],
          dirs: [
            [-1, 0, 0],
            [0, 1, 0],
            [0, 0, -1],
          ],
        },
        {
          pos: [width, depth, height],
          dirs: [
            [-1, 0, 0],
            [0, -1, 0],
            [0, 0, -1],
          ],
        },
        {
          pos: [0, depth, height],
          dirs: [
            [1, 0, 0],
            [0, -1, 0],
            [0, 0, -1],
          ],
        },
      ];

      for (const corner of corners) {
        const [cx, cy, cz] = corner.pos;

        for (const dir of corner.dirs) {
          const [dx, dy, dz] = dir;
          // Line from corner point along direction
          positions.push(
            x + cx,
            y + cy,
            z + cz,
            x + cx + dx * MARKER_SIZE,
            y + cy + dy * MARKER_SIZE,
            z + cz + dz * MARKER_SIZE
          );
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [bins]);

  // Cleanup geometry on unmount
  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  if (bins.length === 0) return null;

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={colors.lineColor} transparent opacity={LINE_OPACITY} />
    </lineSegments>
  );
}
