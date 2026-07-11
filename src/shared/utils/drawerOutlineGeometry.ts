/**
 * Analytic geometry for `DrawerOutline` — flattening, region classification,
 * and arc math. Deliberately brepjs/WASM-free so the same classifier runs on
 * the main thread (placement validation, hatching, split planning) and inside
 * the generation worker (pocket selection); a single implementation is what
 * keeps those decisions from drifting (the `cellMask.ts` precedent).
 */

import type { DrawerOutline } from '@/core/types';

export interface OutlinePoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Rects are inset by this (mm) before boundary tests so an outline segment
 * lying exactly on a grid line or the drawer bbox classifies the abutting
 * cell 'inside' — rectilinear cell-paint outlines must yield full pockets.
 */
export const BOUNDARY_EPS = 0.05;

/** Max chord deviation (mm) when flattening arcs. Far below print tolerance. */
export const ARC_FLATTEN_TOLERANCE = 0.05;

/** Bulges smaller than this are treated as straight segments. */
export const BULGE_EPS = 1e-9;

/**
 * With |bulge| ≤ 1 (sweep ≤ 180°) inside a 50-unit drawer, the largest valid
 * radius is ~half the bbox diagonal (~1485mm), which needs ~192 steps to hold
 * ARC_FLATTEN_TOLERANCE — so 256 never truncates a valid outline's accuracy.
 */
const MAX_ARC_STEPS = 256;

export interface ArcGeometry {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  /** Angle of the segment start point around the center. */
  readonly startAngle: number;
  /** Signed sweep (radians), positive = CCW. `4·atan(bulge)`. */
  readonly sweep: number;
}

/**
 * Circle parameters for an arc segment given its endpoints and bulge
 * (`bulge = tan(sweep/4)`). Returns null for straight/degenerate segments.
 */
export function arcGeometry(p0: OutlinePoint, p1: OutlinePoint, bulge: number): ArcGeometry | null {
  if (Math.abs(bulge) < BULGE_EPS) return null;
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const chord = Math.hypot(dx, dy);
  if (chord < BULGE_EPS) return null;
  const sweep = 4 * Math.atan(bulge);
  const r = (chord * (1 + bulge * bulge)) / (4 * Math.abs(bulge));
  // DXF convention: positive bulge sweeps CCW around the center, bowing the
  // arc to the RIGHT of the travel direction. The center then sits on the
  // LEFT normal at signed distance c(1−b²)/(4b) from the chord midpoint.
  const nx = -dy / chord;
  const ny = dx / chord;
  const centerOffset = (chord * (1 - bulge * bulge)) / (4 * bulge);
  const cx = (p0.x + p1.x) / 2 + nx * centerOffset;
  const cy = (p0.y + p1.y) / 2 + ny * centerOffset;
  return { cx, cy, r, startAngle: Math.atan2(p0.y - cy, p0.x - cx), sweep };
}

/** Point on an arc at parameter `t` ∈ [0,1] along the sweep. */
export function arcPointAt(arc: ArcGeometry, t: number): OutlinePoint {
  const a = arc.startAngle + arc.sweep * t;
  return { x: arc.cx + arc.r * Math.cos(a), y: arc.cy + arc.r * Math.sin(a) };
}

/** Bulge value for an arc spanning `sweep` radians (sign preserved). */
export function bulgeForSweep(sweep: number): number {
  return Math.tan(sweep / 4);
}

const flattenCache = new WeakMap<DrawerOutline, readonly OutlinePoint[]>();

/**
 * Flatten an outline to a closed polyline (no duplicated closing point).
 * Arcs are subdivided to ≤{@link ARC_FLATTEN_TOLERANCE} chord error.
 * Memoized on the outline reference — outlines are immutable by contract.
 */
export function flattenOutline(outline: DrawerOutline): readonly OutlinePoint[] {
  const cached = flattenCache.get(outline);
  if (cached !== undefined) return cached;

  const pts: OutlinePoint[] = [];
  const n = outline.vertices.length;
  for (let i = 0; i < n; i++) {
    const v = outline.vertices[i];
    pts.push({ x: v.x, y: v.y });
    const bulge = v.bulge ?? 0;
    if (Math.abs(bulge) < BULGE_EPS) continue;
    const next = outline.vertices[(i + 1) % n];
    const arc = arcGeometry(v, next, bulge);
    if (arc === null) continue;
    const maxStep =
      arc.r > ARC_FLATTEN_TOLERANCE
        ? 2 * Math.acos(Math.max(0, 1 - ARC_FLATTEN_TOLERANCE / arc.r))
        : Math.PI;
    const steps = Math.min(MAX_ARC_STEPS, Math.max(1, Math.ceil(Math.abs(arc.sweep) / maxStep)));
    for (let s = 1; s < steps; s++) {
      pts.push(arcPointAt(arc, s / steps));
    }
  }
  flattenCache.set(outline, pts);
  return pts;
}

/** Signed area of the outline (positive = CCW), via the flattened polyline. */
export function outlineSignedArea(outline: DrawerOutline): number {
  return polylineSignedArea(flattenOutline(outline));
}

export function polylineSignedArea(pts: readonly OutlinePoint[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

/** Even-odd ray-cast point-in-polygon on a closed polyline. */
export function pointInPolyline(pts: readonly OutlinePoint[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const pi = pts[i];
    const pj = pts[j];
    if (pi.y > y !== pj.y > y && x < ((pj.x - pi.x) * (y - pi.y)) / (pj.y - pi.y) + pi.x) {
      inside = !inside;
    }
  }
  return inside;
}

export function pointInOutline(outline: DrawerOutline, x: number, y: number): boolean {
  return pointInPolyline(flattenOutline(outline), x, y);
}

/** Liang–Barsky: does segment a→b intersect the axis-aligned rect? */
function segmentIntersectsRect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  let t0 = 0;
  let t1 = 1;
  const clips: ReadonlyArray<readonly [number, number]> = [
    [-dx, ax - x0],
    [dx, x1 - ax],
    [-dy, ay - y0],
    [dy, y1 - ay],
  ];
  for (const [p, q] of clips) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
  }
  return t0 <= t1;
}

export type RegionClass = 'inside' | 'outside' | 'partial';

/**
 * Classify an axis-aligned rect (drawer-local mm) against the outline.
 * The rect is inset by {@link BOUNDARY_EPS} first, so boundary-coincident
 * geometry counts as covered. 'partial' = any part of the outline's boundary
 * lies within the (inset) rect — whether passing through or fully contained
 * (a rect enclosing the whole outline is 'partial'); otherwise the center
 * point decides in/out.
 */
export function classifyRect(
  outline: DrawerOutline,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): RegionClass {
  const pts = flattenOutline(outline);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const ix0 = x0 + BOUNDARY_EPS;
  const iy0 = y0 + BOUNDARY_EPS;
  const ix1 = x1 - BOUNDARY_EPS;
  const iy1 = y1 - BOUNDARY_EPS;
  if (ix0 < ix1 && iy0 < iy1) {
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      if (segmentIntersectsRect(pts[j].x, pts[j].y, pts[i].x, pts[i].y, ix0, iy0, ix1, iy1)) {
        return 'partial';
      }
    }
  }
  return pointInPolyline(pts, cx, cy) ? 'inside' : 'outside';
}

const AREA_SAMPLES = 4;

/**
 * Coarse fraction of the rect inside the outline (AREA_SAMPLES² point grid).
 * Used for sliver rules (e.g. "no pocket when a partial cell keeps <X% of its
 * area"), where a rough estimate is sufficient.
 */
export function insideAreaFraction(
  outline: DrawerOutline,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): number {
  const pts = flattenOutline(outline);
  let hits = 0;
  for (let i = 0; i < AREA_SAMPLES; i++) {
    for (let j = 0; j < AREA_SAMPLES; j++) {
      const sx = x0 + ((i + 0.5) / AREA_SAMPLES) * (x1 - x0);
      const sy = y0 + ((j + 0.5) / AREA_SAMPLES) * (y1 - y0);
      if (pointInPolyline(pts, sx, sy)) hits++;
    }
  }
  return hits / (AREA_SAMPLES * AREA_SAMPLES);
}

/**
 * Exact placement test: is the footprint rect (grid units) fully inside the
 * outline? Boundary-coincident footprints count as inside (a bin flush
 * against the drawer wall is valid), courtesy of the classify inset.
 */
export function isFootprintInsideOutline(
  rect: { readonly x: number; readonly y: number; readonly width: number; readonly depth: number },
  outline: DrawerOutline,
  gridUnitMm: number
): boolean {
  return (
    classifyRect(
      outline,
      rect.x * gridUnitMm,
      rect.y * gridUnitMm,
      (rect.x + rect.width) * gridUnitMm,
      (rect.y + rect.depth) * gridUnitMm
    ) === 'inside'
  );
}
