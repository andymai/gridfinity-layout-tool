/**
 * Pure geometry for the pen (freeform perimeter) editor.
 *
 * The editor works in drawer-local mm — the same frame `DrawerOutline` stores —
 * so nothing here converts coordinates. Screen mapping lives in the component.
 *
 * The outline model is a single closed CCW loop whose segments may bow into
 * circular arcs (`bulge` = `tan(sweep/4)`, DXF LWPOLYLINE convention). These
 * helpers keep an in-progress sketch in that same shape so `validateOutline`
 * can grade it on every edit rather than only at apply time.
 */

import type { DrawerOutline, OutlineVertex } from '@/core/types';
import { flattenOutline, polylineSignedArea } from '@/shared/utils/drawerOutlineGeometry';

/** Pointer-to-vertex hit radius, in mm. Scaled by the caller for zoom. */
export const VERTEX_HIT_MM = 6;

/**
 * Snap increments offered in the editor, in grid-unit fractions. A quarter unit
 * (10.5mm at the 42mm standard) is fine enough for a drawer moulding without
 * making every click land on a unique coordinate.
 */
export const SNAP_FRACTIONS = [1, 0.5, 0.25, 0] as const;
export type SnapFraction = (typeof SNAP_FRACTIONS)[number];

/** Snap a drawer-local mm coordinate to the chosen grid fraction. */
export function snapMm(value: number, pitchMm: number, fraction: SnapFraction): number {
  if (fraction === 0) return Math.round(value * 100) / 100;
  const step = pitchMm * fraction;
  return Math.round(value / step) * step;
}

/**
 * Clamp a point into the drawer extent. The perimeter may touch the drawer
 * walls but not leave them, which is what `validateOutline` enforces — doing it
 * during the drag keeps the sketch continuously valid instead of rejecting it
 * only at apply time.
 */
export function clampToDrawer(
  x: number,
  y: number,
  widthMm: number,
  depthMm: number
): { x: number; y: number } {
  return {
    x: Math.min(Math.max(x, 0), widthMm),
    y: Math.min(Math.max(y, 0), depthMm),
  };
}

/** Whether the loop as drawn winds clockwise, so it needs reversing to store. */
export function isClockwise(vertices: readonly OutlineVertex[]): boolean {
  if (vertices.length < 3) return false;
  return polylineSignedArea(flattenOutline({ vertices: [...vertices] })) < 0;
}

/**
 * Reverse a loop's winding, keeping arcs on the same side of the perimeter.
 *
 * A bulge describes the segment leaving its vertex, so reversing the vertex
 * order also moves each bulge to a different segment; it has to travel to the
 * segment's new owner and flip sign, or every curve inverts. Drawn clockwise,
 * an outward bow would become an inward bite.
 */
export function reverseWinding(vertices: readonly OutlineVertex[]): OutlineVertex[] {
  const n = vertices.length;
  const out: OutlineVertex[] = [];
  for (let i = n - 1; i >= 0; i--) {
    // Reversed, the segment leaving vertex i is the one that arrived at it,
    // which the previous vertex owned.
    const bulge = vertices[(i - 1 + n) % n].bulge;
    const v: OutlineVertex = { x: vertices[i].x, y: vertices[i].y };
    out.push(bulge !== undefined && bulge !== 0 ? { ...v, bulge: -bulge } : v);
  }
  return out;
}

/**
 * Build the outline a sketch would store: CCW winding and the `pen` authoring
 * echo, so reopening the editor restores the same points.
 */
export function sketchToOutline(vertices: readonly OutlineVertex[]): DrawerOutline {
  const wound = isClockwise(vertices) ? reverseWinding(vertices) : [...vertices];
  return { vertices: wound, authoring: { kind: 'pen' } };
}

/** Squared distance, for hit tests that never need the root. */
function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** Index of the vertex within `radiusMm` of the point, nearest first, or -1. */
export function hitVertex(
  vertices: readonly OutlineVertex[],
  x: number,
  y: number,
  radiusMm: number
): number {
  let best = -1;
  let bestD = radiusMm * radiusMm;
  for (let i = 0; i < vertices.length; i++) {
    const d = dist2(x, y, vertices[i].x, vertices[i].y);
    if (d <= bestD) {
      best = i;
      bestD = d;
    }
  }
  return best;
}

/**
 * Index of the segment whose midpoint is within `radiusMm` of the point.
 * Midpoints are the arc handles: dragging one bows that segment.
 */
export function hitSegmentMidpoint(
  vertices: readonly OutlineVertex[],
  x: number,
  y: number,
  radiusMm: number
): number {
  let best = -1;
  let bestD = radiusMm * radiusMm;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const d = dist2(x, y, (a.x + b.x) / 2, (a.y + b.y) / 2);
    if (d <= bestD) {
      best = i;
      bestD = d;
    }
  }
  return best;
}

/**
 * Bulge that bows segment `index` through the given point.
 *
 * Sagitta is the perpendicular offset of the point from the chord, signed by
 * which side it falls on; `bulge = 2·sagitta / chord` is the DXF relation.
 * Clamped to ±1 because the model caps arcs at a half circle.
 */
export function bulgeThroughPoint(
  vertices: readonly OutlineVertex[],
  index: number,
  x: number,
  y: number
): number {
  const a = vertices[index];
  const b = vertices[(index + 1) % vertices.length];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-9) return 0;
  // Signed perpendicular offset from the chord. A positive bulge bows RIGHT of
  // travel, which on this CCW loop is away from the interior, so a point on
  // that side must yield a positive bulge.
  const cross = ((x - a.x) * dy - (y - a.y) * dx) / chord;
  const bulge = (2 * cross) / chord;
  return Math.min(Math.max(bulge, -1), 1);
}

/** Replace one vertex, returning a fresh array (outlines are never mutated). */
export function moveVertex(
  vertices: readonly OutlineVertex[],
  index: number,
  x: number,
  y: number
): OutlineVertex[] {
  return vertices.map((v, i) => (i === index ? { ...v, x, y } : v));
}

/** Set one segment's bulge, dropping the field entirely when it straightens. */
export function setBulge(
  vertices: readonly OutlineVertex[],
  index: number,
  bulge: number
): OutlineVertex[] {
  return vertices.map((v, i) => {
    if (i !== index) return v;
    if (Math.abs(bulge) < 1e-4) {
      const { bulge: _drop, ...rest } = v;
      return rest;
    }
    return { ...v, bulge };
  });
}

/**
 * Insert a vertex at the midpoint of segment `index`.
 *
 * A bowed segment splits into two arcs of half the sweep each: `tan(θ/8)` for a
 * segment that was `tan(θ/4)`. Splitting without that leaves the curve jumping
 * the moment a point is added mid-arc.
 */
export function insertVertex(vertices: readonly OutlineVertex[], index: number): OutlineVertex[] {
  const a = vertices[index];
  const b = vertices[(index + 1) % vertices.length];
  const bulge = a.bulge ?? 0;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  if (bulge !== 0) {
    // Offset the new point onto the arc, then halve the sweep on both sides.
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const chord = Math.hypot(dx, dy);
    const sagitta = (bulge * chord) / 2;
    // Right of travel is (dy, -dx)/chord — the same side a positive bulge bows.
    mid.x += (dy / chord) * sagitta;
    mid.y -= (dx / chord) * sagitta;
  }
  const half = bulge === 0 ? 0 : Math.tan(Math.atan(bulge) / 2);
  const out: OutlineVertex[] = [];
  for (let i = 0; i < vertices.length; i++) {
    if (i === index) {
      out.push(half === 0 ? { x: a.x, y: a.y } : { x: a.x, y: a.y, bulge: half });
      out.push(half === 0 ? mid : { ...mid, bulge: half });
    } else {
      out.push(vertices[i]);
    }
  }
  return out;
}

/** Remove a vertex. Returns the input unchanged when it would leave a triangle. */
export function removeVertex(vertices: readonly OutlineVertex[], index: number): OutlineVertex[] {
  if (vertices.length <= 3) return [...vertices];
  return vertices.filter((_, i) => i !== index);
}

/** The drawer rectangle as a CCW loop, the starting point for a new sketch. */
export function rectangleSketch(widthMm: number, depthMm: number): OutlineVertex[] {
  return [
    { x: 0, y: 0 },
    { x: widthMm, y: 0 },
    { x: widthMm, y: depthMm },
    { x: 0, y: depthMm },
  ];
}
