/** Drawer shape validation for share payloads: dimensions, outline and corner cuts. */

import { SHARE_CONSTRAINTS } from './shareConstraints.js';
import { isNumber, isObject, inRange } from './validationUtils.js';

interface OutlineVertexShape {
  x: number;
  y: number;
  bulge?: number;
}

interface CornerCutShape {
  kind: string;
  size?: number;
  r?: number;
  w?: number;
  d?: number;
}

interface DrawerOutlineShape {
  vertices: OutlineVertexShape[];
  authoring?: { kind: string; corners?: Record<string, CornerCutShape> };
}

export interface DrawerShape {
  width: number;
  depth: number;
  height: number;
  fractionalEdgeX?: 'start' | 'end';
  fractionalEdgeY?: 'start' | 'end';
  outline?: DrawerOutlineShape;
  gridShiftX?: number;
  gridShiftY?: number;
  measuredMm?: { width: number; depth: number; height?: number };
}

/** Mirrors CONSTRAINTS.MEASURED_MM_MIN/MAX in src/core/constants.ts. */
const MEASURED_MM_MIN = 1;

const MEASURED_MM_MAX = 5000;

function isValidMeasuredMm(value: unknown): boolean {
  if (!isObject(value)) return false;
  const boundedMm = (v: unknown): boolean =>
    isNumber(v) && inRange(v, MEASURED_MM_MIN, MEASURED_MM_MAX);
  return (
    boundedMm(value.width) &&
    boundedMm(value.depth) &&
    (value.height === undefined || boundedMm(value.height))
  );
}

// Type guards
const isValidGridShift = (value: unknown): value is number =>
  isNumber(value) &&
  inRange(value, -SHARE_CONSTRAINTS.GRID_SHIFT_MM_MAX, SHARE_CONSTRAINTS.GRID_SHIFT_MM_MAX);

export function isValidDrawer(value: unknown): value is DrawerShape {
  if (!isObject(value)) return false;
  if (value.outline !== undefined && !isValidDrawerOutline(value.outline)) return false;
  if (value.measuredMm !== undefined && !isValidMeasuredMm(value.measuredMm)) return false;
  if (value.gridShiftX !== undefined && !isValidGridShift(value.gridShiftX)) return false;
  if (value.gridShiftY !== undefined && !isValidGridShift(value.gridShiftY)) return false;
  return (
    isNumber(value.width) &&
    isNumber(value.depth) &&
    isNumber(value.height) &&
    value.width > 0 &&
    value.depth > 0 &&
    // HeightUnits (7mm each), capped at GRID_MAX so a corrupted client
    // can't sync absurd values to other devices.
    inRange(value.height, SHARE_CONSTRAINTS.HEIGHT_MIN, SHARE_CONSTRAINTS.GRID_MAX)
  );
}

/** Mirrors OUTLINE_MAX_VERTICES in src/shared/utils/drawerOutline.ts. */
const OUTLINE_MAX_VERTICES = 256;

/** 50 units × up to 52mm grid, with slack — mirrors the client Zod schema. */
const OUTLINE_COORD_MIN = -1;

const OUTLINE_COORD_MAX = 2600;

const OUTLINE_AUTHORING_KINDS = ['cells', 'corners', 'trace', 'pen'];

/**
 * Structural gate for a drawer outline: vertex/coordinate/bulge
 * bounds and no self-intersection of the straight-chord approximation. The
 * geometric invariants that need the drawer's mm extent (CCW, min area,
 * in-bounds) are enforced client-side and re-checked at read time by
 * normalizeDrawerOutline — the server's job is to bound the data so a
 * hand-crafted payload can't sync junk or pathological geometry.
 */
function isValidDrawerOutline(value: unknown): value is DrawerOutlineShape {
  if (!isObject(value) || !Array.isArray(value.vertices)) return false;
  const vertices = value.vertices as unknown[];
  if (vertices.length < 3 || vertices.length > OUTLINE_MAX_VERTICES) return false;
  for (const v of vertices) {
    if (!isObject(v)) return false;
    if (
      !isNumber(v.x) ||
      !isNumber(v.y) ||
      !inRange(v.x, OUTLINE_COORD_MIN, OUTLINE_COORD_MAX) ||
      !inRange(v.y, OUTLINE_COORD_MIN, OUTLINE_COORD_MAX)
    ) {
      return false;
    }
    if (v.bulge !== undefined && (!isNumber(v.bulge) || !inRange(v.bulge, -1, 1))) return false;
  }
  // `authoring` is non-geometric editor metadata: reject only structural
  // garbage. An unknown kind (a NEWER client's editor) must not invalidate
  // the layout — sanitizeDrawer drops unrecognized kinds instead.
  if (value.authoring !== undefined) {
    if (!isObject(value.authoring) || typeof value.authoring.kind !== 'string') return false;
  }
  const pts = vertices as OutlineVertexShape[];
  return !outlineChordsSelfIntersect(pts);
}

/** O(n²) chord test — arcs approximated by their chords; good enough to bound
 * pathological payloads (exact arc checks run client-side). Detects proper
 * crossings AND degenerate touches: collinear overlaps and endpoint-on-segment
 * contacts between non-adjacent chords (mirrors segmentsTouch in
 * src/shared/utils/drawerOutline.ts). */
function outlineChordsSelfIntersect(pts: OutlineVertexShape[]): boolean {
  const n = pts.length;
  const orient = (a: OutlineVertexShape, b: OutlineVertexShape, c: OutlineVertexShape): number => {
    const v = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    return Math.abs(v) < 1e-9 ? 0 : Math.sign(v);
  };
  const onSegment = (
    a: OutlineVertexShape,
    b: OutlineVertexShape,
    p: OutlineVertexShape
  ): boolean =>
    Math.min(a.x, b.x) - 1e-6 <= p.x &&
    p.x <= Math.max(a.x, b.x) + 1e-6 &&
    Math.min(a.y, b.y) - 1e-6 <= p.y &&
    p.y <= Math.max(a.y, b.y) + 1e-6;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
      const c = pts[j];
      const d = pts[(j + 1) % n];
      const o1 = orient(a, b, c);
      const o2 = orient(a, b, d);
      const o3 = orient(c, d, a);
      const o4 = orient(c, d, b);
      if (o1 !== o2 && o3 !== o4) return true;
      if (o1 === 0 && onSegment(a, b, c)) return true;
      if (o2 === 0 && onSegment(a, b, d)) return true;
      if (o3 === 0 && onSegment(c, d, a)) return true;
      if (o4 === 0 && onSegment(c, d, b)) return true;
    }
  }
  return false;
}

/**
 * Rebuild the drawer field-by-field. The drawer previously passed through
 * raw, which let arbitrary junk keys survive sanitization; an explicit
 * rebuild keeps exactly the validated shape.
 */
export function sanitizeDrawer(drawer: DrawerShape): DrawerShape {
  const out: DrawerShape = {
    width: drawer.width,
    depth: drawer.depth,
    height: drawer.height,
  };
  if (drawer.fractionalEdgeX === 'start' || drawer.fractionalEdgeX === 'end') {
    out.fractionalEdgeX = drawer.fractionalEdgeX;
  }
  if (drawer.fractionalEdgeY === 'start' || drawer.fractionalEdgeY === 'end') {
    out.fractionalEdgeY = drawer.fractionalEdgeY;
  }
  if (isValidGridShift(drawer.gridShiftX) && drawer.gridShiftX !== 0) {
    out.gridShiftX = drawer.gridShiftX;
  }
  if (isValidGridShift(drawer.gridShiftY) && drawer.gridShiftY !== 0) {
    out.gridShiftY = drawer.gridShiftY;
  }
  if (drawer.outline !== undefined) {
    out.outline = {
      vertices: drawer.outline.vertices.map((v) =>
        v.bulge === undefined || v.bulge === 0
          ? { x: v.x, y: v.y }
          : { x: v.x, y: v.y, bulge: v.bulge }
      ),
      ...(drawer.outline.authoring !== undefined &&
      OUTLINE_AUTHORING_KINDS.includes(drawer.outline.authoring.kind)
        ? {
            authoring: {
              kind: drawer.outline.authoring.kind,
              // The corners editor round-trips its per-corner params through
              // this annotation; keep them when every entry is structurally
              // valid, drop the whole map otherwise.
              ...(sanitizeCornerCuts(drawer.outline.authoring.corners) ?? {}),
            },
          }
        : {}),
    };
  }
  return out;
}

const CORNER_KEYS = ['tl', 'tr', 'bl', 'br'];

const CUT_MAX_MM = 2600;

function isValidCornerCut(value: unknown): value is CornerCutShape {
  if (!isObject(value) || typeof value.kind !== 'string') return false;
  switch (value.kind) {
    case 'none':
      return true;
    case 'chamfer':
      return isNumber(value.size) && inRange(value.size, 0, CUT_MAX_MM);
    case 'radius':
      return isNumber(value.r) && inRange(value.r, 0, CUT_MAX_MM);
    case 'notch':
      return (
        isNumber(value.w) &&
        inRange(value.w, 0, CUT_MAX_MM) &&
        isNumber(value.d) &&
        inRange(value.d, 0, CUT_MAX_MM)
      );
    default:
      return false;
  }
}

function sanitizeCornerCuts(corners: unknown): { corners: Record<string, CornerCutShape> } | null {
  if (!isObject(corners)) return null;
  const out: Record<string, CornerCutShape> = {};
  for (const key of CORNER_KEYS) {
    const cut = corners[key];
    if (!isValidCornerCut(cut)) return null;
    switch (cut.kind) {
      case 'none':
        out[key] = { kind: 'none' };
        break;
      case 'chamfer':
        out[key] = { kind: 'chamfer', size: cut.size };
        break;
      case 'radius':
        out[key] = { kind: 'radius', r: cut.r };
        break;
      default:
        out[key] = { kind: 'notch', w: cut.w, d: cut.d };
    }
  }
  return { corners: out };
}
