/**
 * Model operations for `DrawerOutline`: validation, transforms, hashing,
 * resize (crop/extend), and read-side normalization.
 *
 * Everything here is brepjs/WASM-free and pure. The geometry math (arcs,
 * flattening, classification) lives in `drawerOutlineGeometry.ts`; this module
 * owns the outline's invariants: single closed CCW simple loop, within the
 * drawer's grid extent, enclosing at least one grid cell.
 */

import type { DrawerOutline, Layout, OutlineVertex } from '@/core/types';
import {
  arcGeometry,
  arcPointAt,
  BULGE_EPS,
  bulgeForSweep,
  flattenOutline,
  polylineSignedArea,
  type OutlinePoint,
} from './drawerOutlineGeometry';

/** Coordinates are quantized to this (mm) — keeps hashes and caches stable
 * under float jitter from unit conversions. */
export const OUTLINE_QUANTUM_MM = 0.01;

/** Hard cap on vertices — bounds server validation and worker pen-building. */
export const OUTLINE_MAX_VERTICES = 256;

/** Vertices within this distance (mm) of the drawer bbox snap onto it, so
 * boundary-following outline edges are exactly boundary-coincident. */
export const OUTLINE_SNAP_EPS = 0.05;

const COINCIDENT_EPS = 1e-3;
const LINE_EPS = 1e-6;

export type OutlineValidationErrorKind =
  | 'too_few_vertices'
  | 'too_many_vertices'
  | 'non_finite'
  | 'bad_bulge'
  | 'degenerate_segment'
  | 'out_of_bounds'
  | 'self_intersecting'
  | 'not_ccw'
  | 'too_small';

export interface OutlineValidationError {
  readonly kind: OutlineValidationErrorKind;
  readonly message: string;
}

function err(kind: OutlineValidationErrorKind, message: string): OutlineValidationError {
  return { kind, message };
}

function quantize(value: number): number {
  return Math.round(value / OUTLINE_QUANTUM_MM) * OUTLINE_QUANTUM_MM;
}

/** Round coordinates to {@link OUTLINE_QUANTUM_MM} and bulges to 1e-6. */
export function quantizeOutline(outline: DrawerOutline): DrawerOutline {
  return {
    ...outline,
    vertices: outline.vertices.map((v) => {
      const bulge = v.bulge === undefined ? undefined : Math.round(v.bulge * 1e6) / 1e6;
      return bulge === undefined || bulge === 0
        ? { x: quantize(v.x), y: quantize(v.y) }
        : { x: quantize(v.x), y: quantize(v.y), bulge };
    }),
  };
}

/** Snap vertices within {@link OUTLINE_SNAP_EPS} of the drawer bbox onto it. */
export function snapOutlineToBounds(
  outline: DrawerOutline,
  widthMm: number,
  depthMm: number
): DrawerOutline {
  const snapAxis = (value: number, max: number): number => {
    if (Math.abs(value) <= OUTLINE_SNAP_EPS) return 0;
    if (Math.abs(value - max) <= OUTLINE_SNAP_EPS) return max;
    return value;
  };
  return {
    ...outline,
    vertices: outline.vertices.map((v) => {
      const x = snapAxis(v.x, widthMm);
      const y = snapAxis(v.y, depthMm);
      if (x === v.x && y === v.y) return v;
      return v.bulge === undefined ? { x, y } : { x, y, bulge: v.bulge };
    }),
  };
}

function orient(a: OutlinePoint, b: OutlinePoint, c: OutlinePoint): number {
  const v = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (Math.abs(v) < 1e-9) return 0;
  return Math.sign(v);
}

function onSegment(a: OutlinePoint, b: OutlinePoint, p: OutlinePoint): boolean {
  return (
    Math.min(a.x, b.x) - LINE_EPS <= p.x &&
    p.x <= Math.max(a.x, b.x) + LINE_EPS &&
    Math.min(a.y, b.y) - LINE_EPS <= p.y &&
    p.y <= Math.max(a.y, b.y) + LINE_EPS
  );
}

function segmentsTouch(
  a: OutlinePoint,
  b: OutlinePoint,
  c: OutlinePoint,
  d: OutlinePoint
): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a, b, c)) return true;
  if (o2 === 0 && onSegment(a, b, d)) return true;
  if (o3 === 0 && onSegment(c, d, a)) return true;
  if (o4 === 0 && onSegment(c, d, b)) return true;
  return false;
}

/**
 * Chord-approximate: runs on the flattened polyline, so an arc-arc crossing
 * shallower than ~2× ARC_FLATTEN_TOLERANCE (≈0.1mm) can slip through. Such a
 * graze is below print resolution and the BREP boolean handles it; exact
 * arc-arc intersection isn't worth the complexity here.
 */
function isSelfIntersecting(pts: readonly OutlinePoint[]): boolean {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      // Adjacent segments legitimately share an endpoint.
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
      if (segmentsTouch(a, b, pts[j], pts[(j + 1) % n])) return true;
    }
  }
  return false;
}

/**
 * Check every outline invariant. Returns null when valid.
 * `widthMm`/`depthMm` are the drawer's grid extent; `gridUnitMm` sets the
 * minimum-area rule (one grid cell).
 */
export function validateOutline(
  outline: DrawerOutline,
  widthMm: number,
  depthMm: number,
  gridUnitMm: number
): OutlineValidationError | null {
  const verts = outline.vertices;
  if (verts.length < 3) return err('too_few_vertices', 'outline needs at least 3 vertices');
  if (verts.length > OUTLINE_MAX_VERTICES) {
    return err('too_many_vertices', `outline exceeds ${OUTLINE_MAX_VERTICES} vertices`);
  }
  for (const v of verts) {
    if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) {
      return err('non_finite', 'outline has non-finite coordinates');
    }
    if (v.bulge !== undefined && (!Number.isFinite(v.bulge) || Math.abs(v.bulge) > 1 + 1e-9)) {
      return err('bad_bulge', 'outline bulge must be finite with |bulge| <= 1');
    }
  }
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    if (Math.hypot(b.x - a.x, b.y - a.y) < COINCIDENT_EPS) {
      return err('degenerate_segment', 'outline has coincident consecutive vertices');
    }
  }
  const pts = flattenOutline(outline);
  for (const p of pts) {
    if (
      p.x < -OUTLINE_SNAP_EPS ||
      p.x > widthMm + OUTLINE_SNAP_EPS ||
      p.y < -OUTLINE_SNAP_EPS ||
      p.y > depthMm + OUTLINE_SNAP_EPS
    ) {
      return err('out_of_bounds', 'outline leaves the drawer extent');
    }
  }
  if (isSelfIntersecting(pts)) {
    return err('self_intersecting', 'outline crosses itself');
  }
  const area = polylineSignedArea(pts);
  if (area <= 0) return err('not_ccw', 'outline must wind counter-clockwise');
  if (area < gridUnitMm * gridUnitMm) {
    return err('too_small', 'outline must enclose at least one grid cell');
  }
  return null;
}

/** Translate all vertices. Drops the authoring annotation (pipeline-only op). */
export function translateOutline(outline: DrawerOutline, dx: number, dy: number): DrawerOutline {
  return {
    vertices: outline.vertices.map((v) =>
      v.bulge === undefined
        ? { x: v.x + dx, y: v.y + dy }
        : { x: v.x + dx, y: v.y + dy, bulge: v.bulge }
    ),
  };
}

/**
 * Rotate 180° about the extent center: (x,y) → (W−x, D−y). Rotation preserves
 * winding and sweep direction, so vertex order and bulges are unchanged.
 * Drops the authoring annotation (pipeline-only op).
 */
export function rotateOutline180(
  outline: DrawerOutline,
  widthMm: number,
  depthMm: number
): DrawerOutline {
  return {
    vertices: outline.vertices.map((v) =>
      v.bulge === undefined
        ? { x: widthMm - v.x, y: depthMm - v.y }
        : { x: widthMm - v.x, y: depthMm - v.y, bulge: v.bulge }
    ),
  };
}

/**
 * Stable short hash of the outline GEOMETRY (vertices quantized to 0.01mm,
 * bulges to 1e-6; `authoring` excluded) — for cache keys and fingerprints.
 * 32-bit FNV-1a in base36, mirroring `hashMask`.
 */
export function hashOutline(outline: DrawerOutline): string {
  let h = 2166136261;
  const mix = (value: number): void => {
    // Two rounds so 32-bit-truncated ints keep their high bits' influence.
    h = Math.imul(h ^ (value | 0), 16777619);
    h = Math.imul(h ^ ((value / 4294967296) | 0), 16777619);
  };
  for (const v of outline.vertices) {
    mix(Math.round(v.x / OUTLINE_QUANTUM_MM));
    mix(Math.round(v.y / OUTLINE_QUANTUM_MM));
    mix(Math.round((v.bulge ?? 0) * 1e6));
  }
  return (h >>> 0).toString(36);
}

interface MutableVertex {
  x: number;
  y: number;
  bulge: number;
}

function toMutable(vertices: readonly OutlineVertex[]): MutableVertex[] {
  return vertices.map((v) => ({ x: v.x, y: v.y, bulge: v.bulge ?? 0 }));
}

function toVertices(verts: readonly MutableVertex[]): OutlineVertex[] {
  return verts.map((v) =>
    Math.abs(v.bulge) < BULGE_EPS ? { x: v.x, y: v.y } : { x: v.x, y: v.y, bulge: v.bulge }
  );
}

type Axis = 'x' | 'y';

function coord(p: OutlinePoint, axis: Axis): number {
  return axis === 'x' ? p.x : p.y;
}

/** Which side of the clip line to keep: 'min' = `coord ≤ k`, 'max' = `coord ≥ k`. */
type KeepSide = 'min' | 'max';

/**
 * Clip the loop against an axis-aligned half-plane, splitting arcs at the
 * clip line (sub-arc bulges recomputed from the sub-sweep). Gaps between kept
 * pieces close with straight connectors, which necessarily lie on the clip
 * line. Returns null when fewer than 3 vertices survive.
 */
function clipHalfPlane(
  verts: readonly MutableVertex[],
  axis: Axis,
  k: number,
  keep: KeepSide = 'min'
): MutableVertex[] | null {
  const inside = (p: OutlinePoint): boolean =>
    keep === 'min' ? coord(p, axis) <= k + LINE_EPS : coord(p, axis) >= k - LINE_EPS;
  const out: MutableVertex[] = [];

  const append = (p: OutlinePoint, bulge: number): void => {
    const last = out.at(-1);
    if (last !== undefined && Math.hypot(last.x - p.x, last.y - p.y) < COINCIDENT_EPS) {
      last.bulge = bulge;
      return;
    }
    out.push({ x: p.x, y: p.y, bulge });
  };

  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % n];
    const arc = arcGeometry(a, b, a.bulge);

    if (arc === null) {
      const aIn = inside(a);
      const bIn = inside(b);
      if (aIn && bIn) {
        append(a, a.bulge);
        append(b, 0);
      } else if (aIn !== bIn) {
        const t = (k - coord(a, axis)) / (coord(b, axis) - coord(a, axis));
        const ix = a.x + (b.x - a.x) * t;
        const iy = a.y + (b.y - a.y) * t;
        if (aIn) {
          append(a, a.bulge);
          append({ x: ix, y: iy }, 0);
        } else {
          append({ x: ix, y: iy }, 0);
          append(b, 0);
        }
      }
      continue;
    }

    // Arc: find clip-line crossings as sweep parameters, then keep the
    // sub-arcs whose midpoints are inside. An arc can dip out and back in
    // even when both endpoints are inside.
    const center = axis === 'x' ? arc.cx : arc.cy;
    const dist = k - center;
    const cuts: number[] = [];
    if (Math.abs(dist) < arc.r) {
      const off = Math.sqrt(arc.r * arc.r - dist * dist);
      const angles =
        axis === 'x'
          ? [Math.atan2(off, dist), Math.atan2(-off, dist)]
          : [Math.atan2(dist, off), Math.atan2(dist, -off)];
      for (const angle of angles) {
        let delta = angle - arc.startAngle;
        const tau = 2 * Math.PI;
        delta = arc.sweep > 0 ? ((delta % tau) + tau) % tau : -(((-delta % tau) + tau) % tau);
        const t = delta / arc.sweep;
        if (t > 1e-6 && t < 1 - 1e-6) cuts.push(t);
      }
      cuts.sort((p, q) => p - q);
    }
    const bounds = [0, ...cuts, 1];
    for (let s = 0; s < bounds.length - 1; s++) {
      const t0 = bounds[s];
      const t1 = bounds[s + 1];
      if (!inside(arcPointAt(arc, (t0 + t1) / 2))) continue;
      const p0 = t0 === 0 ? a : arcPointAt(arc, t0);
      const p1 = t1 === 1 ? b : arcPointAt(arc, t1);
      append(p0, bulgeForSweep(arc.sweep * (t1 - t0)));
      append(p1, 0);
    }
  }

  while (
    out.length > 1 &&
    Math.hypot(out[out.length - 1].x - out[0].x, out[out.length - 1].y - out[0].y) < COINCIDENT_EPS
  ) {
    out.pop();
  }
  return out.length >= 3 ? out : null;
}

/**
 * Extend the loop across a grown drawer edge. The grown strip
 * (`newRect \ oldRect` on this axis) defaults to inside, welded to the shape
 * along the segment run the outline shares with the moved edge. Exactly one
 * maximal run must exist: zero means the strip would be disconnected, two or
 * more would enclose a hole — both unrepresentable, so the caller resets to a
 * full rectangle (returns null).
 */
function growAxis(
  verts: readonly MutableVertex[],
  axis: Axis,
  oldK: number,
  newK: number,
  crossExtent: number
): MutableVertex[] | null {
  const n = verts.length;
  const onEdge = (i: number): boolean => {
    const a = verts[i];
    const b = verts[(i + 1) % n];
    return (
      Math.abs(a.bulge) < BULGE_EPS &&
      Math.abs(coord(a, axis) - oldK) <= LINE_EPS &&
      Math.abs(coord(b, axis) - oldK) <= LINE_EPS
    );
  };

  const runStarts: number[] = [];
  for (let i = 0; i < n; i++) {
    if (onEdge(i) && !onEdge((i - 1 + n) % n)) runStarts.push(i);
  }
  if (runStarts.length !== 1) return null;

  let runEnd = runStarts[0];
  while (onEdge(runEnd)) runEnd = (runEnd + 1) % n;

  // Rotate so the run's interior vertices sit at the end of the array:
  // rotated[0] follows the run, rotated[last] starts it.
  const start = runStarts[0];
  const rotated: MutableVertex[] = [];
  for (let i = runEnd; i !== start; i = (i + 1) % n) rotated.push(verts[i]);
  const runStartVertex = verts[start];
  const runEndVertex = verts[runEnd];

  // Walk the strip's boundary from weld start to weld end (CCW, interior
  // left). X axis: down the old edge, around the strip; Y axis mirrored.
  const detour: MutableVertex[] = [{ ...runStartVertex, bulge: 0 }];
  const push = (x: number, y: number): void => {
    const last = detour[detour.length - 1];
    if (Math.hypot(last.x - x, last.y - y) >= COINCIDENT_EPS) {
      detour.push({ x, y, bulge: 0 });
    }
  };
  if (axis === 'x') {
    push(oldK, 0);
    push(newK, 0);
    push(newK, crossExtent);
    push(oldK, crossExtent);
  } else {
    push(crossExtent, oldK);
    push(crossExtent, newK);
    push(0, newK);
    push(0, oldK);
  }
  const last = detour[detour.length - 1];
  if (Math.hypot(last.x - runEndVertex.x, last.y - runEndVertex.y) < COINCIDENT_EPS) {
    detour.pop();
  }

  return [...rotated, ...detour];
}

/**
 * Topology test, not an area tolerance: the loop traces the full rectangle
 * exactly when every segment is straight and hugs one of the four boundary
 * lines. A corner-cutting edge (e.g. a small chamfer) has its endpoints on
 * two DIFFERENT lines, so even cuts far smaller than any area epsilon are
 * preserved as intentional geometry.
 */
function isFullRectangle(outline: DrawerOutline, widthMm: number, depthMm: number): boolean {
  const n = outline.vertices.length;
  for (let i = 0; i < n; i++) {
    const a = outline.vertices[i];
    const b = outline.vertices[(i + 1) % n];
    if (Math.abs(a.bulge ?? 0) >= BULGE_EPS) return false;
    const onCommonLine =
      (Math.abs(a.x) <= OUTLINE_SNAP_EPS && Math.abs(b.x) <= OUTLINE_SNAP_EPS) ||
      (Math.abs(a.x - widthMm) <= OUTLINE_SNAP_EPS &&
        Math.abs(b.x - widthMm) <= OUTLINE_SNAP_EPS) ||
      (Math.abs(a.y) <= OUTLINE_SNAP_EPS && Math.abs(b.y) <= OUTLINE_SNAP_EPS) ||
      (Math.abs(a.y - depthMm) <= OUTLINE_SNAP_EPS && Math.abs(b.y - depthMm) <= OUTLINE_SNAP_EPS);
    if (!onCommonLine) return false;
  }
  return true;
}

function dropCoincident(verts: MutableVertex[]): MutableVertex[] {
  const out: MutableVertex[] = [];
  for (const v of verts) {
    const prev = out.at(-1);
    if (prev !== undefined && Math.hypot(prev.x - v.x, prev.y - v.y) < COINCIDENT_EPS) {
      prev.bulge = v.bulge;
      continue;
    }
    out.push(v);
  }
  while (
    out.length > 1 &&
    Math.hypot(out[out.length - 1].x - out[0].x, out[out.length - 1].y - out[0].y) < COINCIDENT_EPS
  ) {
    out.pop();
  }
  return out;
}

/**
 * Adapt an outline to resized drawer dims (mm): cropped where the drawer
 * shrank, extended (new area inside) where it grew. Returns:
 * - the same outline when dims are unchanged,
 * - a new outline when the crop/extend succeeded,
 * - `undefined` when the result is the full rectangle OR degenerate/invalid —
 *   the caller must fall back to a plain rectangular drawer (drop the field).
 *
 * The authoring annotation is dropped whenever geometry changes; editors
 * re-derive their state from geometry.
 */
export function resizeDrawerOutline(
  outline: DrawerOutline,
  oldWidthMm: number,
  oldDepthMm: number,
  newWidthMm: number,
  newDepthMm: number,
  gridUnitMm: number
): DrawerOutline | undefined {
  const sameW = Math.abs(newWidthMm - oldWidthMm) < OUTLINE_QUANTUM_MM;
  const sameD = Math.abs(newDepthMm - oldDepthMm) < OUTLINE_QUANTUM_MM;
  if (sameW && sameD) return outline;

  let verts: MutableVertex[] | null = toMutable(outline.vertices);
  if (!sameW) {
    verts =
      newWidthMm < oldWidthMm
        ? clipHalfPlane(verts, 'x', newWidthMm)
        : growAxis(verts, 'x', oldWidthMm, newWidthMm, oldDepthMm);
  }
  if (verts !== null && !sameD) {
    verts =
      newDepthMm < oldDepthMm
        ? clipHalfPlane(verts, 'y', newDepthMm)
        : growAxis(verts, 'y', oldDepthMm, newDepthMm, newWidthMm);
  }
  if (verts === null) return undefined;

  verts = dropCoincident(verts);
  if (verts.length < 3) return undefined;

  const candidate = snapOutlineToBounds(
    quantizeOutline({ vertices: toVertices(verts) }),
    newWidthMm,
    newDepthMm
  );
  if (isFullRectangle(candidate, newWidthMm, newDepthMm)) return undefined;
  if (validateOutline(candidate, newWidthMm, newDepthMm, gridUnitMm) !== null) return undefined;
  return candidate;
}

/**
 * Read-side ingress guard: never trust a stored outline. Crops it to the
 * current drawer extent (an old client may have resized the drawer without
 * touching the outline), quantizes/snaps, and drops it entirely when invalid
 * or rectangle-equivalent. Returns the input layout when nothing changes.
 */
/** Structural check for untrusted outline data: an object with an array of
 * ≥3 vertex objects carrying finite numeric coordinates. */
function isStructurallyOutline(value: unknown): value is DrawerOutline {
  if (typeof value !== 'object' || value === null) return false;
  const vertices = (value as { vertices?: unknown }).vertices;
  if (!Array.isArray(vertices) || vertices.length < 3) return false;
  return vertices.every(
    (v: unknown) =>
      typeof v === 'object' &&
      v !== null &&
      Number.isFinite((v as { x?: unknown }).x) &&
      Number.isFinite((v as { y?: unknown }).y)
  );
}

export function normalizeDrawerOutline(layout: Layout): Layout {
  // Tolerate malformed payloads (ingress guard runs before full validation).
  const outline = (layout.drawer as Layout['drawer'] | undefined)?.outline as unknown;
  if (outline === undefined) return layout;

  const widthMm = (layout.drawer.width as number) * (layout.gridUnitMm as number);
  const depthMm = (layout.drawer.depth as number) * (layout.gridUnitMm as number);

  const drop = (): Layout => {
    const drawer = { ...layout.drawer };
    delete drawer.outline;
    return { ...layout, drawer };
  };

  // null / non-object / vertex-less garbage from corrupted storage or
  // hand-edited JSON: drop rather than crash ingestion.
  if (!isStructurallyOutline(outline)) return drop();

  let verts: MutableVertex[] | null = toMutable(outline.vertices);
  verts = clipHalfPlane(verts, 'x', widthMm, 'min');
  if (verts !== null) verts = clipHalfPlane(verts, 'y', depthMm, 'min');
  if (verts !== null) verts = clipHalfPlane(verts, 'x', 0, 'max');
  if (verts !== null) verts = clipHalfPlane(verts, 'y', 0, 'max');
  if (verts === null) return drop();

  verts = dropCoincident(verts);
  if (verts.length < 3) return drop();

  const candidate = snapOutlineToBounds(
    quantizeOutline({ vertices: toVertices(verts), authoring: outline.authoring }),
    widthMm,
    depthMm
  );
  if (isFullRectangle(candidate, widthMm, depthMm)) return drop();
  if (validateOutline(candidate, widthMm, depthMm, layout.gridUnitMm) !== null) {
    return drop();
  }

  const unchanged =
    candidate.vertices.length === outline.vertices.length &&
    candidate.vertices.every((v, i) => {
      const o = outline.vertices[i];
      return v.x === o.x && v.y === o.y && (v.bulge ?? 0) === (o.bulge ?? 0);
    });
  if (unchanged) return layout;
  return { ...layout, drawer: { ...layout.drawer, outline: candidate } };
}
