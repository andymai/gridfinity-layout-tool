/**
 * Shared outline geometry for cutout ghosts, in whatever frame the caller hands
 * it. Used by the bin's interior ghost and the lid's plate ghost.
 */

import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import type { Cutout } from '@/features/bin-designer/types';
import {
  flattenPath,
  MIN_PATH_POINTS,
} from '@/features/bin-designer/components/panel/CutoutsSection/pathGeometry';

/** Number of segments for circle approximation */
const CIRCLE_SEGMENTS = 24;

/**
 * Line segments outlining each cutout at the surface it is cut from and again at
 * its own depth, plus verticals between the two.
 *
 * Takes the surface PLANE rather than a floor and a wall height, because the two
 * hosts arrive at it differently: a bin cutout starts at `floorZ + wallHeight`,
 * a lid cutout at the plate's own host face. Everything below that is identical,
 * which is the reason this is shared rather than reimplemented per host.
 */
export function buildCutoutGeometry(
  cutoutsToRender: readonly Cutout[],
  originX: number,
  originY: number,
  surfaceZ: number
): LineSegmentsGeometry | null {
  const positions: number[] = [];

  for (const cutout of cutoutsToRender) {
    const cx = originX + cutout.x + cutout.width / 2;
    const cy = originY + cutout.y + cutout.depth / 2;
    const topZ = surfaceZ;
    const bottomZ = surfaceZ - cutout.cutDepth;

    if (cutout.shape === 'circle') {
      const rx = cutout.width / 2;
      const ry = cutout.depth / 2;
      const rad = (-cutout.rotation * Math.PI) / 180;
      const cosR = Math.cos(rad);
      const sinR = Math.sin(rad);
      for (let z = 0; z < 2; z++) {
        const zVal = z === 0 ? topZ : bottomZ;
        for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
          const a1 = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
          const a2 = ((i + 1) / CIRCLE_SEGMENTS) * Math.PI * 2;
          // Parametric ellipse points, then rotate
          const ex1 = Math.cos(a1) * rx;
          const ey1 = Math.sin(a1) * ry;
          const ex2 = Math.cos(a2) * rx;
          const ey2 = Math.sin(a2) * ry;
          positions.push(
            cx + ex1 * cosR - ey1 * sinR,
            cy + ex1 * sinR + ey1 * cosR,
            zVal,
            cx + ex2 * cosR - ey2 * sinR,
            cy + ex2 * sinR + ey2 * cosR,
            zVal
          );
        }
      }
      // Vertical lines connecting top and bottom ellipses (4 cardinal points)
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const ex = Math.cos(a) * rx;
        const ey = Math.sin(a) * ry;
        const px = cx + ex * cosR - ey * sinR;
        const py = cy + ex * sinR + ey * cosR;
        positions.push(px, py, topZ, px, py, bottomZ);
      }
    } else if (cutout.shape === 'path' && cutout.path && cutout.path.length >= MIN_PATH_POINTS) {
      // Flatten bezier path to polyline and render actual shape outline
      const flat = flattenPath(cutout.path);
      const n = flat.length;
      if (n >= 3) {
        // Path points are in bin-local absolute coords — offset by origin
        for (let z = 0; z < 2; z++) {
          const zVal = z === 0 ? topZ : bottomZ;
          for (let i = 0; i < n; i++) {
            const p1 = flat[i];
            const p2 = flat[(i + 1) % n];
            positions.push(
              originX + p1.x,
              originY + p1.y,
              zVal,
              originX + p2.x,
              originY + p2.y,
              zVal
            );
          }
        }
        // Vertical lines at every few vertices to show depth
        const vertStep = Math.max(1, Math.floor(n / 8));
        for (let i = 0; i < n; i += vertStep) {
          const p = flat[i];
          positions.push(originX + p.x, originY + p.y, topZ, originX + p.x, originY + p.y, bottomZ);
        }
      }
    } else {
      const hw = cutout.width / 2;
      const hd = cutout.depth / 2;
      // Unrotated corners relative to center
      const rawCorners: [number, number][] = [
        [-hw, -hd],
        [hw, -hd],
        [hw, hd],
        [-hw, hd],
      ];
      // Apply rotation around center
      const rad = (-cutout.rotation * Math.PI) / 180;
      const cosR = Math.cos(rad);
      const sinR = Math.sin(rad);
      const corners = rawCorners.map(([rx, ry]) => [
        cx + rx * cosR - ry * sinR,
        cy + rx * sinR + ry * cosR,
      ]);

      for (let z = 0; z < 2; z++) {
        const zVal = z === 0 ? topZ : bottomZ;
        for (let i = 0; i < 4; i++) {
          const [x1, y1] = corners[i];
          const [x2, y2] = corners[(i + 1) % 4];
          positions.push(x1, y1, zVal, x2, y2, zVal);
        }
      }
      for (const [px, py] of corners) {
        positions.push(px, py, topZ, px, py, bottomZ);
      }
    }
  }

  if (positions.length === 0) return null;

  const geo = new LineSegmentsGeometry();
  geo.setPositions(positions);
  return geo;
}
