/**
 * A cutout's top-down outline as a closed ring in the interior's mm frame,
 * already rotated about the cutout's centre. One sampling for every reader
 * that measures a shape rather than cutting it: the editor's Pathfinder
 * preview, the open-side channels (worker, lip-gap plan and canvas overlay)
 * and the SVG export. Insertion clearance is deliberately not applied: the
 * editor shows the nominal size and the worker expands at cut time.
 */

import type { Cutout } from '@/shared/types/bin';
import { DEFAULT_POLYGON_SIDES, MIN_PATH_POINTS } from '@/shared/types/bin';
import { clampPolygonSides, regularPolygonPoints, slotCornerRadius } from './cutoutPolygon';
import { flattenPath, type Point2D } from './pathGeometryBezier';

export type OutlinePoint = [number, number];
export type OutlineRing = OutlinePoint[];

const CIRCLE_SEGMENTS = 64;
const CORNER_SEGMENTS_PER_QUADRANT = 8;

export function rotateAbout(
  x: number,
  y: number,
  cx: number,
  cy: number,
  rotationDeg: number
): OutlinePoint {
  if (rotationDeg === 0) return [x, y];
  const a = (-rotationDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
}

function rectangleRing(c: Cutout): OutlineRing {
  const cx = c.x + c.width / 2;
  const cy = c.y + c.depth / 2;
  const r = Math.max(0, Math.min(c.cornerRadius, c.width / 2, c.depth / 2));
  const ring: OutlineRing = [];
  const push = (x: number, y: number): void => {
    ring.push(rotateAbout(x, y, cx, cy, c.rotation));
  };
  if (r === 0) {
    push(c.x, c.y);
    push(c.x + c.width, c.y);
    push(c.x + c.width, c.y + c.depth);
    push(c.x, c.y + c.depth);
    return ring;
  }
  const arc = (acx: number, acy: number, startAngle: number): void => {
    const step = Math.PI / 2 / CORNER_SEGMENTS_PER_QUADRANT;
    for (let i = 0; i <= CORNER_SEGMENTS_PER_QUADRANT; i++) {
      const a = startAngle + step * i;
      push(acx + r * Math.cos(a), acy + r * Math.sin(a));
    }
  };
  arc(c.x + r, c.y + r, Math.PI);
  arc(c.x + c.width - r, c.y + r, -Math.PI / 2);
  arc(c.x + c.width - r, c.y + c.depth - r, 0);
  arc(c.x + r, c.y + c.depth - r, Math.PI / 2);
  return ring;
}

/**
 * Circles carry independent width and depth and the worker cuts the true
 * ellipse, so the ring samples the same one or a grouped ellipse's preview
 * diverges from the mesh along its long axis.
 */
function circleRing(c: Cutout): OutlineRing {
  const cx = c.x + c.width / 2;
  const cy = c.y + c.depth / 2;
  const rx = c.width / 2;
  const ry = c.depth / 2;
  const ring: OutlineRing = [];
  for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
    const a = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
    ring.push(rotateAbout(cx + rx * Math.cos(a), cy + ry * Math.sin(a), cx, cy, c.rotation));
  }
  return ring;
}

function polygonRing(c: Cutout): OutlineRing | null {
  const cx = c.x + c.width / 2;
  const cy = c.y + c.depth / 2;
  const pts = regularPolygonPoints(
    clampPolygonSides(c.sides ?? DEFAULT_POLYGON_SIDES),
    c.width,
    c.depth
  );
  if (pts.length < 3) return null;
  return pts.map((p) => rotateAbout(cx + p.x, cy + p.y, cx, cy, c.rotation));
}

/** Path vertices are absolute mm, so only the rotation is applied. */
function pathRing(c: Cutout): OutlineRing | null {
  if (!c.path || c.path.length < MIN_PATH_POINTS) return null;
  const flat: Point2D[] = flattenPath(c.path);
  if (flat.length < 3) return null;
  const cx = c.x + c.width / 2;
  const cy = c.y + c.depth / 2;
  return flat.map((p) => rotateAbout(p.x, p.y, cx, cy, c.rotation));
}

/**
 * The outline ring, or null for a shape too degenerate to outline. A text
 * element cuts nothing, and a mesh imprint's silhouette lives in its asset,
 * so neither has a ring here.
 */
export function cutoutOutlineRing(c: Cutout): OutlineRing | null {
  if (c.shape === 'text' || c.shape === 'mesh') return null;
  if (c.shape === 'path') return pathRing(c);
  if (c.width <= 0 || c.depth <= 0) return null;
  if (c.shape === 'circle') return circleRing(c);
  if (c.shape === 'polygon') return polygonRing(c);
  if (c.shape === 'slot' || c.shape === 'knifeSlot') {
    return rectangleRing({ ...c, cornerRadius: slotCornerRadius(c.width, c.depth) });
  }
  return rectangleRing(c);
}

export interface OutlineBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export function ringBounds(ring: OutlineRing): OutlineBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}
