import { useMemo, useEffect } from 'react';
import * as THREE from 'three';

interface BinCornerMarkersProps {
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  opacity?: number;
}

// L-shaped marker arm length
const MARKER_SIZE = 0.12;
const LINE_COLOR = '#ffffff';
const LINE_OPACITY = 0.4;

/**
 * L-shaped corner markers at all 8 corners of a bin.
 * Architectural drawing convention for indicating precise boundaries.
 */
export function BinCornerMarkers({
  x,
  y,
  z,
  width,
  depth,
  height,
  opacity = 1,
}: BinCornerMarkersProps) {
  // Build line segments for all 8 corners
  const geometry = useMemo(() => {
    const positions: number[] = [];

    // Corner definitions: [cornerX, cornerY, cornerZ, dirX, dirY, dirZ]
    // Each corner has 3 L-arms pointing along the edges
    const corners = [
      // Bottom corners (z = 0)
      { pos: [0, 0, 0], dirs: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] },
      { pos: [width, 0, 0], dirs: [[-1, 0, 0], [0, 1, 0], [0, 0, 1]] },
      { pos: [width, depth, 0], dirs: [[-1, 0, 0], [0, -1, 0], [0, 0, 1]] },
      { pos: [0, depth, 0], dirs: [[1, 0, 0], [0, -1, 0], [0, 0, 1]] },
      // Top corners (z = height)
      { pos: [0, 0, height], dirs: [[1, 0, 0], [0, 1, 0], [0, 0, -1]] },
      { pos: [width, 0, height], dirs: [[-1, 0, 0], [0, 1, 0], [0, 0, -1]] },
      { pos: [width, depth, height], dirs: [[-1, 0, 0], [0, -1, 0], [0, 0, -1]] },
      { pos: [0, depth, height], dirs: [[1, 0, 0], [0, -1, 0], [0, 0, -1]] },
    ];

    for (const corner of corners) {
      const [cx, cy, cz] = corner.pos;

      for (const dir of corner.dirs) {
        const [dx, dy, dz] = dir;
        // Line from corner point along direction
        positions.push(
          x + cx, y + cy, z + cz,
          x + cx + dx * MARKER_SIZE, y + cy + dy * MARKER_SIZE, z + cz + dz * MARKER_SIZE
        );
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [x, y, z, width, depth, height]);

  // Cleanup geometry on unmount or when dependencies change
  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        color={LINE_COLOR}
        transparent
        opacity={LINE_OPACITY * opacity}
      />
    </lineSegments>
  );
}
