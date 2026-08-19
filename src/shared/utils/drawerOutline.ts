/**
 * Model operations for `DrawerOutline`: validation, transforms, hashing,
 * and read-side normalization.
 *
 * Everything here is brepjs/WASM-free and pure. The geometry math (arcs,
 * flattening, classification) lives in `drawerOutlineGeometry.ts`; this module
 * owns the outline's invariants: single closed CCW simple loop, within the
 * drawer's own extent ({@link outlineExtentMm} — NOT the grid's), enclosing at
 * least one grid cell.
 */

import type { Drawer, DrawerOutline, Layout, OutlineVertex } from '@/core/types';
import { effectiveGridUnitMmY } from '@/core/types';
import { CONSTRAINTS } from '@/core/constants';
import { clamp } from './math';
import {
  arcGeometry,
  arcPointAt,
  BULGE_EPS,
  bulgeForSweep,
  flattenOutline,
  outlineBounds,
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

/**
 * The box a drawer perimeter may occupy, in drawer-local mm.
 *
 * The grid extent is NOT the bound. A measured drawer is the physical thing the
 * perimeter traces; the grid is a lattice laid inside it, which the user is
 * free to make smaller and to position with padding. Bounding the perimeter by
 * the grid made that combination impossible — shrinking the grid clipped the
 * shape, or dropped it outright — which forced the grid up to the shape and
 * left every surplus cell to be cut.
 *
 * Widened, never narrowed: a shape authored against a larger grid extent stays
 * valid when a smaller measurement is recorded afterwards.
 *
 * The measurement is clamped HERE rather than trusted. `updateDrawer` clamps
 * what it writes, but an imported, shared or synced layout reaches the store
 * without passing through it — `validateImport` grades the drawer's width,
 * depth and height and never looks at `measuredMm`, which was inert until this
 * function gave it authority over the perimeter. A non-finite value is the one
 * that matters: `Math.max(extent, NaN)` is `NaN`, and every `point > NaN`
 * comparison in `validateOutline` is false, so an unguarded read does not widen
 * the bound — it removes it.
 *
 * This is the permitted box only. "Does this outline hug the grid" — the no-op
 * rectangle test and the boundary snap — still measures the GRID extent, since
 * a rectangle at the drawer's size on a smaller grid is real geometry that
 * trims cells, not an absent outline.
 */
function safeMeasured(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return clamp(value, 0, CONSTRAINTS.MEASURED_MM_MAX);
}

export function outlineExtentMm(
  drawer: Pick<Drawer, 'width' | 'depth' | 'measuredMm'>,
  gridUnitMm: number,
  gridUnitMmY: number
): { widthMm: number; depthMm: number } {
  const measured = drawer.measuredMm;
  return {
    widthMm: Math.max((drawer.width as number) * gridUnitMm, safeMeasured(measured?.width)),
    depthMm: Math.max((drawer.depth as number) * gridUnitMmY, safeMeasured(measured?.depth)),
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
export function isSelfIntersecting(pts: readonly OutlinePoint[]): boolean {
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
 * `widthMm`/`depthMm` are the box the perimeter may occupy — pass
 * {@link outlineExtentMm}, not the bare grid extent, or a grid smaller than the
 * drawer rejects the drawer's own shape. `gridUnitMm` sets the minimum-area
 * rule (one grid cell).
 */
export function validateOutline(
  outline: DrawerOutline,
  widthMm: number,
  depthMm: number,
  gridUnitMm: number,
  // Depth-axis pitch for a non-square grid; defaults to the X pitch (square).
  gridUnitMmY: number = gridUnitMm
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
  if (area < gridUnitMm * gridUnitMmY) {
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

/**
 * Rotate the vertex loop to a canonical starting index so a closed outline and
 * any cyclic shift of it hash equal — in particular a point-symmetric loop and
 * its 180° rotation, which trace the same polygon shifted by n/2. Winding,
 * bulges, and the vertex→next-edge bulge association are all preserved; only the
 * start moves. Picks the rotation whose quantized (x, y, bulge) vertex sequence
 * is lexicographically smallest so a repeated smallest vertex still resolves
 * deterministically. Drops the authoring annotation (pipeline-only op).
 */
export function canonicalStartOutline(outline: DrawerOutline): DrawerOutline {
  const verts = outline.vertices;
  const n = verts.length;
  if (n < 2) return { vertices: verts.map((v) => v) };
  const keys = verts.map((v): readonly [number, number, number] => [
    Math.round(v.x / OUTLINE_QUANTUM_MM),
    Math.round(v.y / OUTLINE_QUANTUM_MM),
    Math.round((v.bulge ?? 0) * 1e6),
  ]);
  // True iff the rotation starting at index `a` is lexicographically smaller
  // than the one starting at `b`, comparing the full vertex sequence.
  const rotationLess = (a: number, b: number): boolean => {
    for (let i = 0; i < n; i++) {
      const ka = keys[(a + i) % n];
      const kb = keys[(b + i) % n];
      for (let c = 0; c < 3; c++) {
        if (ka[c] !== kb[c]) return ka[c] < kb[c];
      }
    }
    return false;
  };
  let best = 0;
  for (let s = 1; s < n; s++) {
    if (rotationLess(s, best)) best = s;
  }
  const rotated = best === 0 ? verts : [...verts.slice(best), ...verts.slice(0, best)];
  return { vertices: rotated.map((v) => v) };
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
 * Topology test, not an area tolerance: the loop traces the full rectangle
 * exactly when every segment is straight and hugs one of the four boundary
 * lines. A corner-cutting edge (e.g. a small chamfer) has its endpoints on
 * two DIFFERENT lines, so even cuts far smaller than any area epsilon are
 * preserved as intentional geometry.
 */
export function isOutlineFullRectangle(
  outline: DrawerOutline,
  widthMm: number,
  depthMm: number
): boolean {
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
 * Smallest half-unit count covering `mm` at `pitch`. The epsilon keeps an
 * exact boundary (e.g. 8.5 units × 48mm, whose product carries float noise)
 * from ceiling an extra half unit. Every "how many units does this length
 * need" callsite must share this so clamps and grows agree on the boundary.
 */
export function ceilHalfUnits(mm: number, pitch: number): number {
  return Math.ceil((mm / pitch) * 2 - 1e-9) / 2;
}

/**
 * Smallest half-unit drawer dims that contain the outline — the floor a
 * drawer resize may shrink to while a custom shape is active (a resize
 * must never crop or extend the user's shape, so the dims clamp instead).
 * Measured on the flattened path (an arc bows past its own endpoints) and on
 * {@link ceilHalfUnits}, shared with the pen editor's auto-grow.
 */
export function minDrawerUnitsForOutline(
  outline: DrawerOutline,
  gridUnitMm: number,
  // Depth-axis pitch for a non-square grid; defaults to the X pitch (square).
  gridUnitMmY: number = gridUnitMm
): { readonly width: number; readonly depth: number } {
  const b = outlineBounds(outline);
  return {
    width: Math.max(0.5, ceilHalfUnits(b.maxX, gridUnitMm)),
    depth: Math.max(0.5, ceilHalfUnits(b.maxY, gridUnitMmY)),
  };
}

/**
 * Drawer dims (grid units) a resize may clamp down to: the outline's bounding
 * half-unit grid while a custom shape is active, the plain grid minimum
 * without one. Shared by the CQRS command, the store mirror and the size
 * steppers so all three refuse the same shrinks.
 */
export function drawerSizeFloors(
  outline: DrawerOutline | undefined,
  gridUnitMm: number,
  gridUnitMmY: number = gridUnitMm
): { readonly width: number; readonly depth: number } {
  if (outline === undefined) {
    return { width: CONSTRAINTS.GRID_MIN, depth: CONSTRAINTS.GRID_MIN };
  }
  const min = minDrawerUnitsForOutline(outline, gridUnitMm, gridUnitMmY);
  return {
    width: clamp(min.width, CONSTRAINTS.GRID_MIN, CONSTRAINTS.GRID_MAX),
    depth: clamp(min.depth, CONSTRAINTS.GRID_MIN, CONSTRAINTS.GRID_MAX),
  };
}

/** Range a grid pitch may be set to (mm), either axis. */
const GRID_PITCH_MM_MIN = 1;
export const GRID_PITCH_MM_MAX = 200;

/**
 * Grid pitch (mm) a pitch change may clamp down to, per axis. Lowering the
 * pitch shrinks the mm extent without touching the stored outline, and the
 * read-side normalizer would then clip the shape on the next load (
 * nothing may mutate the shape implicitly, so the pitch clamps instead).
 * Floors round up to 0.01mm so `units × pitch ≥ bounds` survives float noise.
 * On a square grid the X pitch drives both axes, so its floor honours the Y
 * bound too. Shared by the CQRS commands and their store mirrors.
 */
export function gridPitchFloors(layout: Pick<Layout, 'drawer' | 'gridUnitMm' | 'gridUnitMmY'>): {
  readonly x: number;
  readonly y: number;
} {
  const outline = layout.drawer.outline;
  if (outline === undefined) return { x: GRID_PITCH_MM_MIN, y: GRID_PITCH_MM_MIN };
  const b = outlineBounds(outline);
  const floor = (extentMm: number, units: number): number =>
    clamp(Math.ceil((extentMm / units) * 100 - 1e-6) / 100, GRID_PITCH_MM_MIN, GRID_PITCH_MM_MAX);
  const x = floor(b.maxX, layout.drawer.width);
  const y = floor(b.maxY, layout.drawer.depth);
  return { x: layout.gridUnitMmY === undefined ? Math.max(x, y) : x, y };
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

  const gridUnitMmY = effectiveGridUnitMmY(layout) as number;
  // Two boxes, deliberately: the perimeter is clipped and graded against the
  // DRAWER (which may exceed the grid), while "hugs the boundary" and "is the
  // full rectangle" stay grid questions — a rectangle at the drawer's size on a
  // smaller grid trims cells and must survive as real geometry.
  const gridWidthMm = (layout.drawer.width as number) * (layout.gridUnitMm as number);
  const gridDepthMm = (layout.drawer.depth as number) * gridUnitMmY;
  const { widthMm, depthMm } = outlineExtentMm(layout.drawer, layout.gridUnitMm, gridUnitMmY);

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
    gridWidthMm,
    gridDepthMm
  );
  if (isOutlineFullRectangle(candidate, gridWidthMm, gridDepthMm)) return drop();
  if (validateOutline(candidate, widthMm, depthMm, layout.gridUnitMm, gridUnitMmY) !== null) {
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
