import type { BinShear } from '@/shared/hooks/useBinGeometry';

const MARKER_SIZE = 0.12;

export interface CornerMarkerBin {
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  opacity: number;
  shear?: BinShear;
}

export function cornerMarkerPositions(bins: readonly CornerMarkerBin[]): number[] {
  const positions: number[] = [];
  for (const bin of bins) {
    const { x, y, z, width, depth, height, shear } = bin;
    const rise = shear ? Math.max(0, height - shear.pivot) : 0;
    const topX = shear ? shear.x * rise : 0;
    const topY = shear ? shear.y * rise : 0;
    const down = [-(shear?.x ?? 0), -(shear?.y ?? 0), -1];

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
        pos: [topX, topY, height],
        dirs: [[1, 0, 0], [0, 1, 0], down],
      },
      {
        pos: [width + topX, topY, height],
        dirs: [[-1, 0, 0], [0, 1, 0], down],
      },
      {
        pos: [width + topX, depth + topY, height],
        dirs: [[-1, 0, 0], [0, -1, 0], down],
      },
      {
        pos: [topX, depth + topY, height],
        dirs: [[1, 0, 0], [0, -1, 0], down],
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
  return positions;
}
