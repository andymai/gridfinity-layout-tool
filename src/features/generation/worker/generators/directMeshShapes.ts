/**
 * 2D shape primitives for direct mesh generation: rounded rectangles
 * (full and selectively-rounded), circles, and point-in-polygon tests.
 *
 * These mirror the BREP profile shapes used in `baseplateGenerator` so the
 * direct-mesh and BREP variants render visually congruent.
 */

import type { ResolvedBaseplateParams } from '@/shared/types/bin';

/**
 * Generate points for a rounded rectangle centered at origin.
 * Returns CCW points when viewed from +Z looking down.
 *
 * Corner layout:
 *   3──────2    (back-left, back-right)
 *   │      │
 *   0──────1    (front-left, front-right)
 *
 * Path starts at front-left corner, goes right (CCW from outside = +Z).
 */
export function roundedRectPoints(
  w: number,
  d: number,
  r: number,
  segments: number
): ReadonlyArray<readonly [number, number]> {
  const hw = w / 2;
  const hd = d / 2;
  const clampedR = Math.min(r, hw - 0.01, hd - 0.01);
  const effectiveR = Math.max(clampedR, 0);

  if (effectiveR < 0.01) {
    return [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
    ];
  }

  const pts: Array<[number, number]> = [];

  // Corner centers and start angles (CCW)
  const corners: ReadonlyArray<readonly [number, number, number]> = [
    [-hw + effectiveR, -hd + effectiveR, Math.PI], // front-left: 180° to 270°
    [hw - effectiveR, -hd + effectiveR, (3 * Math.PI) / 2], // front-right: 270° to 360°
    [hw - effectiveR, hd - effectiveR, 0], // back-right: 0° to 90°
    [-hw + effectiveR, hd - effectiveR, Math.PI / 2], // back-left: 90° to 180°
  ];

  for (const [cx, cy, startAngle] of corners) {
    for (let i = 0; i <= segments; i++) {
      const angle = startAngle + (i / segments) * (Math.PI / 2);
      pts.push([cx + effectiveR * Math.cos(angle), cy + effectiveR * Math.sin(angle)]);
    }
  }

  return pts;
}

/**
 * Generate points for a rounded rectangle with selective corner rounding.
 * Only exterior corners (where both adjacent edges are exterior) get rounded.
 */
export function roundedRectPointsSelective(
  w: number,
  d: number,
  r: number,
  segments: number,
  edges?: ResolvedBaseplateParams['edges']
): ReadonlyArray<readonly [number, number]> {
  if (
    !edges ||
    (edges.left === 'exterior' &&
      edges.right === 'exterior' &&
      edges.front === 'exterior' &&
      edges.back === 'exterior')
  ) {
    return roundedRectPoints(w, d, r, segments);
  }

  const hw = w / 2;
  const hd = d / 2;
  const clampedR = Math.min(r, hw - 0.01, hd - 0.01);
  const effectiveR = Math.max(clampedR, 0);

  const roundFL = edges.left === 'exterior' && edges.front === 'exterior' && effectiveR > 0.01;
  const roundFR = edges.right === 'exterior' && edges.front === 'exterior' && effectiveR > 0.01;
  const roundBR = edges.right === 'exterior' && edges.back === 'exterior' && effectiveR > 0.01;
  const roundBL = edges.left === 'exterior' && edges.back === 'exterior' && effectiveR > 0.01;

  const pts: Array<[number, number]> = [];
  const corners: ReadonlyArray<readonly [number, number, number, boolean]> = [
    [-hw + effectiveR, -hd + effectiveR, Math.PI, roundFL],
    [hw - effectiveR, -hd + effectiveR, (3 * Math.PI) / 2, roundFR],
    [hw - effectiveR, hd - effectiveR, 0, roundBR],
    [-hw + effectiveR, hd - effectiveR, Math.PI / 2, roundBL],
  ];

  const sharpCorners: ReadonlyArray<readonly [number, number]> = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ];

  for (let c = 0; c < 4; c++) {
    const [cx, cy, startAngle, shouldRound] = corners[c];
    if (shouldRound) {
      for (let i = 0; i <= segments; i++) {
        const angle = startAngle + (i / segments) * (Math.PI / 2);
        pts.push([cx + effectiveR * Math.cos(angle), cy + effectiveR * Math.sin(angle)]);
      }
    } else {
      pts.push([sharpCorners[c][0], sharpCorners[c][1]]);
    }
  }

  return pts;
}

/** Generate circle points (CCW from +Z) centered at origin. */
export function circlePoints(
  radius: number,
  segments: number
): ReadonlyArray<readonly [number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    pts.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  return pts;
}

/**
 * Even-odd ray cast for point-in-polygon. The polygon is given in local
 * coordinates with a translation offset — slab outer profiles are kept in
 * grid-relative form so the same `outerPts` array drives outer walls,
 * padding ring, and gusset clipping.
 */
export function pointInPolygon(
  px: number,
  py: number,
  polygon: ReadonlyArray<readonly [number, number]>,
  offsetX: number,
  offsetY: number
): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i][0] + offsetX;
    const yi = polygon[i][1] + offsetY;
    const xj = polygon[j][0] + offsetX;
    const yj = polygon[j][1] + offsetY;
    if (yi > py !== yj > py) {
      const xCross = ((xj - xi) * (py - yi)) / (yj - yi) + xi;
      if (px < xCross) inside = !inside;
    }
  }
  return inside;
}
