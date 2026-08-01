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
import {
  arcGeometry,
  flattenOutline,
  polylineSignedArea,
} from '@/shared/utils/drawerOutlineGeometry';

/**
 * Radius (mm) of a drawn handle, as a fraction of the drawer's longest side, so
 * handles stay the same apparent size whatever the drawer measures.
 */
export function handleRadiusMm(widthMm: number, depthMm: number): number {
  return Math.max(widthMm, depthMm) / 110;
}

/**
 * Grab radius for a handle. Comfortably larger than the drawn handle rather
 * than a fixed millimetre value: on a 420mm drawer a fixed 6mm radius lands at
 * roughly 6px on screen, which is smaller than the dot it is meant to catch.
 */
export function hitRadiusMm(widthMm: number, depthMm: number): number {
  return handleRadiusMm(widthMm, depthMm) * 2.4;
}

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

/** Chord shorter than this has no defined direction, so no arc can be built on it. */
const MIN_CHORD_MM = 1e-9;

/**
 * Point at the middle of a segment's actual path: the chord midpoint for a
 * straight segment, lifted onto the arc by the sagitta for a bowed one.
 *
 * The single source for that offset — `segmentHandle` needs it to draw the
 * handle where it can be grabbed and `insertVertex` needs it to put a new
 * corner on the curve, and the two must stay sign- and scale-identical or a
 * split would move the arc. Returns null for a degenerate chord, which is
 * reachable mid-drag when two corners are dragged onto each other.
 */
function arcMidpoint(
  a: OutlineVertex,
  b: OutlineVertex
): { x: number; y: number; chord: number } | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const chord = Math.hypot(dx, dy);
  if (chord < MIN_CHORD_MM) return null;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const bulge = a.bulge ?? 0;
  if (bulge === 0) return { ...mid, chord };
  // Right of travel is (dy, -dx)/chord — the side a positive bulge bows.
  const sagitta = (bulge * chord) / 2;
  return { x: mid.x + (dy / chord) * sagitta, y: mid.y - (dx / chord) * sagitta, chord };
}

/** Midpoint of a segment along its actual path, which is the arc handle's home. */
export function segmentHandle(
  vertices: readonly OutlineVertex[],
  index: number
): { x: number; y: number } {
  const a = vertices[index];
  const b = vertices[(index + 1) % vertices.length];
  const m = arcMidpoint(a, b);
  return m === null ? { x: a.x, y: a.y } : { x: m.x, y: m.y };
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
    // Hit-test where the handle is drawn, which is on the arc, not the chord —
    // otherwise a bowed segment's handle cannot be grabbed where it appears.
    const h = segmentHandle(vertices, i);
    const d = dist2(x, y, h.x, h.y);
    if (d <= bestD) {
      best = i;
      bestD = d;
    }
  }
  return best;
}

/**
 * Bulge for the arc from a segment's endpoints that actually passes through the
 * given point.
 *
 * Derived from the circle through the three points rather than from the
 * point's perpendicular offset alone: an offset-only formula ignores where
 * along the chord the pointer sits, so dragging a handle sideways produced a
 * curve that missed the cursor. Clamped to ±1 because the model caps arcs at a
 * half circle.
 */
export function bulgeThroughPoint(
  vertices: readonly OutlineVertex[],
  index: number,
  x: number,
  y: number
): number {
  const a = vertices[index];
  const b = vertices[(index + 1) % vertices.length];
  // Circumcentre of a, p, b. The determinant is twice the signed triangle area,
  // so it vanishes exactly when the three are collinear — a straight segment.
  const ax = a.x - x;
  const ay = a.y - y;
  const bx = b.x - x;
  const by = b.y - y;
  const d = 2 * (ax * by - ay * bx);
  if (Math.abs(d) < 1e-12) return 0;
  const aLen = ax * ax + ay * ay;
  const bLen = bx * bx + by * by;
  const cx = x + (by * aLen - ay * bLen) / d;
  const cy = y + (ax * bLen - bx * aLen) / d;

  const angA = Math.atan2(a.y - cy, a.x - cx);
  const angB = Math.atan2(b.y - cy, b.x - cx);
  const angP = Math.atan2(y - cy, x - cx);
  const TAU = Math.PI * 2;
  const norm = (t: number): number => ((t % TAU) + TAU) % TAU;
  // Travel counter-clockwise from a to b; if the pointer is not on that arc,
  // the intended sweep is the clockwise one instead.
  const ccw = norm(angB - angA);
  const sweep = norm(angP - angA) <= ccw ? ccw : ccw - TAU;
  return Math.min(Math.max(Math.tan(sweep / 4), -1), 1);
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
  const mid = arcMidpoint(a, b);
  // Two corners dragged onto each other leave a zero-length segment. Splitting
  // it would divide by the chord and write NaN into the sketch, which is not
  // recoverable by editing; refusing the split leaves it fixable.
  if (mid === null) return [...vertices];
  const bulge = a.bulge ?? 0;
  const half = bulge === 0 ? 0 : Math.tan(Math.atan(bulge) / 2);
  const out: OutlineVertex[] = [];
  for (let i = 0; i < vertices.length; i++) {
    if (i === index) {
      out.push(half === 0 ? { x: a.x, y: a.y } : { x: a.x, y: a.y, bulge: half });
      out.push(half === 0 ? { x: mid.x, y: mid.y } : { x: mid.x, y: mid.y, bulge: half });
    } else {
      out.push(vertices[i]);
    }
  }
  return out;
}

/**
 * Remove a vertex. Returns the input unchanged when it would leave a triangle.
 *
 * The predecessor's bulge described an arc ending at the removed corner; after
 * the join it would describe a different arc, to a different endpoint, so the
 * segment spanning the gap is straightened rather than left curving somewhere
 * nobody asked for.
 */
export function removeVertex(vertices: readonly OutlineVertex[], index: number): OutlineVertex[] {
  return removeVertices(vertices, new Set([index]));
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

/**
 * SVG path data for a sketch, in the same drawer-local mm the vertices use —
 * the caller supplies the viewBox, so no scaling happens here.
 *
 * Bowed segments become real SVG arcs rather than flattened polylines, so the
 * curve stays smooth at any zoom. `sweep-flag` is 1 for a CCW sweep, matching
 * the sign of `bulge`; `large-arc-flag` is always 0 because the model caps
 * arcs at a half circle.
 */
export function sketchPathD(vertices: readonly OutlineVertex[]): string {
  if (vertices.length < 2) return '';
  const n = vertices.length;
  const parts: string[] = [`M ${vertices[0].x} ${vertices[0].y}`];
  for (let i = 0; i < n; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    const arc = arcGeometry(a, b, a.bulge ?? 0);
    if (arc !== null) {
      parts.push(`A ${arc.r} ${arc.r} 0 0 ${arc.sweep > 0 ? 1 : 0} ${b.x} ${b.y}`);
      continue;
    }
    // `Z` already draws the straight closing segment, so emitting it too would
    // duplicate the line. A bowed closing segment still needs its arc, which is
    // why the skip is only for the straight case.
    if (i < n - 1) parts.push(`L ${b.x} ${b.y}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

/** A guide line the drag has snapped to, in drawer-local mm. */
export interface AlignGuides {
  /** Vertical guide: the shared x, or null when nothing aligned. */
  readonly x: number | null;
  /** Horizontal guide: the shared y, or null. */
  readonly y: number | null;
  /** The point after snapping to whichever guides matched. */
  readonly point: { readonly x: number; readonly y: number };
}

/**
 * Nearest alignment of `point` to the x or y of any vertex not being dragged.
 *
 * Each axis resolves independently, so a corner can align vertically with one
 * neighbour and horizontally with another — which is what makes a drawn shape
 * come out square without the user aiming for it. Vertices under the drag are
 * excluded, or a multi-corner drag would align to itself and stick.
 */
export function alignmentGuides(
  vertices: readonly OutlineVertex[],
  moving: ReadonlySet<number>,
  point: { x: number; y: number },
  toleranceMm: number
): AlignGuides {
  let bestX: number | null = null;
  let bestY: number | null = null;
  let dx = toleranceMm;
  let dy = toleranceMm;
  for (let i = 0; i < vertices.length; i++) {
    if (moving.has(i)) continue;
    const v = vertices[i];
    const ax = Math.abs(v.x - point.x);
    if (ax <= dx) {
      dx = ax;
      bestX = v.x;
    }
    const ay = Math.abs(v.y - point.y);
    if (ay <= dy) {
      dy = ay;
      bestY = v.y;
    }
  }
  return { x: bestX, y: bestY, point: { x: bestX ?? point.x, y: bestY ?? point.y } };
}

/** Indices whose vertex falls inside the marquee rectangle (drawer-local mm). */
export function verticesInRect(
  vertices: readonly OutlineVertex[],
  x0: number,
  y0: number,
  x1: number,
  y1: number
): number[] {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  const out: number[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i];
    if (v.x >= minX && v.x <= maxX && v.y >= minY && v.y <= maxY) out.push(i);
  }
  return out;
}

/**
 * Largest translation of `indices` that keeps every one of them in the drawer.
 *
 * Clamping only the grabbed corner is not enough: the same delta applies to the
 * whole selection, so dragging a selected edge sideways would carry its far
 * corner straight through the wall and leave the outline unappliable.
 */
export function clampGroupDelta(
  vertices: readonly OutlineVertex[],
  indices: ReadonlySet<number>,
  dx: number,
  dy: number,
  widthMm: number,
  depthMm: number
): { dx: number; dy: number } {
  let lo = { x: Infinity, y: Infinity };
  let hi = { x: -Infinity, y: -Infinity };
  for (const i of indices) {
    const v = vertices[i];
    if (v === undefined) continue;
    lo = { x: Math.min(lo.x, v.x), y: Math.min(lo.y, v.y) };
    hi = { x: Math.max(hi.x, v.x), y: Math.max(hi.y, v.y) };
  }
  if (!Number.isFinite(lo.x)) return { dx: 0, dy: 0 };
  return {
    dx: Math.min(Math.max(dx, -lo.x), widthMm - hi.x),
    dy: Math.min(Math.max(dy, -lo.y), depthMm - hi.y),
  };
}

/** Translate the given vertices, leaving the rest and every bulge untouched. */
export function moveVertices(
  vertices: readonly OutlineVertex[],
  indices: ReadonlySet<number>,
  dx: number,
  dy: number
): OutlineVertex[] {
  return vertices.map((v, i) => (indices.has(i) ? { ...v, x: v.x + dx, y: v.y + dy } : v));
}

/**
 * Remove several vertices at once, refusing to drop below a triangle.
 *
 * Every survivor whose successor is being removed has its bulge cleared: that
 * bulge described an arc to the corner going away, and after the join it would
 * curve to a different endpoint entirely.
 */
export function removeVertices(
  vertices: readonly OutlineVertex[],
  indices: ReadonlySet<number>
): OutlineVertex[] {
  const n = vertices.length;
  if (n - indices.size < 3) return [...vertices];
  const out: OutlineVertex[] = [];
  for (let i = 0; i < n; i++) {
    if (indices.has(i)) continue;
    const v = vertices[i];
    if (indices.has((i + 1) % n) && (v.bulge ?? 0) !== 0) {
      const { bulge: _drop, ...straight } = v;
      out.push(straight);
    } else {
      out.push(v);
    }
  }
  return out;
}
