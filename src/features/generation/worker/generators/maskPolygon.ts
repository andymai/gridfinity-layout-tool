/**
 * Mask → brepjs Drawing converter for non-rectangular bin footprints.
 *
 * Converts a {@link CellMask} into a closed Drawing suitable for extrusion
 * or lofting. The polygon is centered on the origin (like the rectangular
 * `drawRoundedRectangle` path) and shrunk by `CLEARANCE / 2` on each side
 * to match the tolerance gap used by standard Gridfinity bins.
 *
 * Corners are rounded so adjacent bins on a Gridfinity baseplate nest
 * cleanly. Convex (90°) corners round outward with BOX_CORNER_RADIUS.
 * Concave (270°) corners round inward with the same radius — this is the
 * inverse fillet that makes the profile of an L-shape tile seamlessly
 * against a neighbouring 1×1 bin: curves match tangentially on both sides
 * of the shared cell boundary.
 *
 * Insets are computed geometrically on the polygon vertices rather than via
 * `Drawing.offset()`. brepjs 15.x returns a silently-empty Drawing when
 * `offset()` runs on a concave polygon, which later crashes `sketchOnPlane`
 * with "empty drawing". Since every mask polygon is axis-aligned with 90°
 * turns, we can shift each edge perpendicular-inward by the inset distance
 * and recompute vertex intersections in closed form, then lay down arcs at
 * each corner of the inset polygon.
 */
import { draw } from 'brepjs';
import type { Drawing } from 'brepjs';
import { CLEARANCE, BOX_CORNER_RADIUS } from './generatorConstants';
import { resolvePitch, type GridUnitInput } from './gridPitch';
import { MASK_CELL_SIZE, maskToPolygon, type CellMask, type Point2 } from '@/shared/utils/cellMask';

interface Point2Mm {
  readonly x: number;
  readonly y: number;
}

/** Minimum arc radius — below this we emit a sharp corner instead. */
const MIN_ARC_RADIUS = 0.05;

/**
 * Inset an axis-aligned CCW polygon by `inset` mm, moving every edge
 * perpendicular-inward. Every edge is horizontal or vertical and every
 * turn is 90° (mask polygons are produced by `maskToPolygon`), so the new
 * vertex is the intersection of the two inset-shifted edges.
 *
 * For a CCW polygon the interior lies on the LEFT of each edge direction.
 * The interior-pointing normal at a 90° corner is the sum of the two
 * adjacent edges' left-normals; shifting the vertex by `inset *` that sum
 * places it at the intersection of the two shifted edges.
 */
function insetAxisAlignedPolygon(vertices: readonly Point2Mm[], inset: number): Point2Mm[] {
  const n = vertices.length;
  const result: Point2Mm[] = [];
  for (let i = 0; i < n; i++) {
    const prev = vertices[(i - 1 + n) % n];
    const cur = vertices[i];
    const next = vertices[(i + 1) % n];

    const dxIn = Math.sign(cur.x - prev.x);
    const dyIn = Math.sign(cur.y - prev.y);
    const dxOut = Math.sign(next.x - cur.x);
    const dyOut = Math.sign(next.y - cur.y);

    // Left-normal of direction (dx, dy) is (-dy, dx).
    const nx = -dyIn + -dyOut;
    const ny = dxIn + dxOut;

    result.push({ x: cur.x + inset * nx, y: cur.y + inset * ny });
  }
  return result;
}

/** Shortest edge length in an axis-aligned polygon. */
function minEdgeLength(vertices: readonly Point2Mm[]): number {
  let min = Infinity;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    const len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y); // axis-aligned
    if (len < min) min = len;
  }
  return min;
}

/**
 * Per-vertex arc information for an axis-aligned CCW polygon.
 *
 * `convex` is true for 90° left turns (standard outer corners), false for
 * 270° right turns (reflex corners inside an L/T/U notch). `tangentIn` and
 * `tangentOut` are the points on each adjacent edge where the corner arc
 * begins and ends. The straight edge segment from `tangentOut[i]` to
 * `tangentIn[i+1]` forms the flat run between corners.
 */
interface CornerInfo {
  readonly convex: boolean;
  readonly tangentIn: Point2Mm;
  readonly tangentOut: Point2Mm;
  readonly radius: number;
}

function computeCorners(vertices: readonly Point2Mm[], radius: number): CornerInfo[] {
  const n = vertices.length;
  const corners: CornerInfo[] = [];
  for (let i = 0; i < n; i++) {
    const prev = vertices[(i - 1 + n) % n];
    const cur = vertices[i];
    const next = vertices[(i + 1) % n];

    const dxIn = Math.sign(cur.x - prev.x);
    const dyIn = Math.sign(cur.y - prev.y);
    const dxOut = Math.sign(next.x - cur.x);
    const dyOut = Math.sign(next.y - cur.y);

    // Cross product of (dxIn, dyIn) × (dxOut, dyOut): +1 convex, -1 concave.
    const convex = dxIn * dyOut - dyIn * dxOut > 0;

    corners.push({
      convex,
      tangentIn: { x: cur.x - radius * dxIn, y: cur.y - radius * dyIn },
      tangentOut: { x: cur.x + radius * dxOut, y: cur.y + radius * dyOut },
      radius,
    });
  }
  return corners;
}

/** Build a closed Drawing from a sharp CCW polygon — fallback when the arc radius is too small. */
function buildSharpDrawing(vertices: readonly Point2Mm[]): Drawing {
  let pen = draw([vertices[0].x, vertices[0].y]);
  for (let i = 1; i < vertices.length; i++) {
    pen = pen.lineTo([vertices[i].x, vertices[i].y]);
  }
  return pen.close();
}

function buildRoundedDrawing(vertices: readonly Point2Mm[], radius: number): Drawing {
  const n = vertices.length;
  const corners = computeCorners(vertices, radius);

  // Start at the exit tangent of the last corner so the first operation is
  // a straight line into corner 0 — this gives tangentArcTo a valid tangent
  // reference for every arc, including the first one.
  const start = corners[n - 1].tangentOut;
  let pen = draw([start.x, start.y]);
  for (let i = 0; i < n; i++) {
    const { tangentIn, tangentOut } = corners[i];
    pen = pen.lineTo([tangentIn.x, tangentIn.y]);
    pen = pen.tangentArcTo([tangentOut.x, tangentOut.y]);
  }
  return pen.close();
}

/** Convert a grid-unit loop to mm, centred on the bin origin. Width scales by
 * `unitX`, depth by `unitY` (equal for a square grid). */
function loopToMm(
  loop: readonly Point2[],
  halfWidthMm: number,
  halfDepthMm: number,
  unitX: number,
  unitY: number
): Point2Mm[] {
  return loop.map((p) => ({
    x: p.x * unitX - halfWidthMm,
    y: p.y * unitY - halfDepthMm,
  }));
}

/**
 * Build a closed Drawing for one loop at the given inset and corner
 * radius. Expects the loop in CCW orientation: `insetAxisAlignedPolygon`
 * then shifts each vertex inward by the sum of the two adjacent edges'
 * left-normals, so `+inset` shrinks the polygon and `-inset` grows it.
 *
 * Radius is clamped to min(requested, shortestEdge/2 − ε). When the
 * clamp falls below `MIN_ARC_RADIUS` the function emits sharp corners so
 * narrow features can't collapse the loft.
 */
function buildLoopDrawing(
  loopMm: readonly Point2Mm[],
  insetMm: number,
  cornerRadiusMm: number
): Drawing {
  const shifted: readonly Point2Mm[] =
    insetMm !== 0 ? insetAxisAlignedPolygon(loopMm, insetMm) : loopMm;

  const maxRadius = minEdgeLength(shifted) / 2 - 0.01;
  const r = Math.min(cornerRadiusMm, maxRadius);

  if (r < MIN_ARC_RADIUS) {
    return buildSharpDrawing(shifted);
  }
  return buildRoundedDrawing(shifted, r);
}

/**
 * Build a closed Drawing for the mask's outer perimeter at the given inset
 * and corner radius. Inner-hole loops are NOT subtracted here — callers
 * that need the holes build separate hole drawings via
 * `buildMaskHoleDrawings` and cut them at the 3D stage, which the bin
 * generator already does reliably for other subtractive features.
 *
 * (Earlier revisions tried `drawingCut` on the holes at the 2D stage, but
 * cut2D's curve-relationship detection doesn't always recognise our pen-
 * built rounded polygons as strictly-inside — the cut returns the outer
 * unchanged. A 3D boolean cut avoids that path entirely.)
 */
export function buildMaskDrawingAtInset(
  mask: CellMask,
  gridUnitMm: GridUnitInput,
  insetMm: number,
  cornerRadiusMm: number
): Drawing {
  const loops = maskToPolygon(mask);
  const outer = loops[0];
  if (outer.length < 3) {
    throw new Error(`mask polygon has only ${outer.length} vertices (need 3+)`);
  }

  const { x: unitX, y: unitY } = resolvePitch(gridUnitMm);
  const halfWidthMm = (mask.cols * MASK_CELL_SIZE * unitX) / 2;
  const halfDepthMm = (mask.rows * MASK_CELL_SIZE * unitY) / 2;

  const outerMm = loopToMm(outer, halfWidthMm, halfDepthMm, unitX, unitY);
  return buildLoopDrawing(outerMm, insetMm, cornerRadiusMm);
}

/**
 * Whether the mask encloses any empty cells (O-shape interiors). `maskToPolygon`
 * returns the outer perimeter as loop 0 and one loop per enclosed hole.
 */
export function maskHasHoles(mask: CellMask): boolean {
  return maskToPolygon(mask).length > 1;
}

/**
 * Build one Drawing per inner hole in the mask. Each drawing represents
 * the cavity region in CCW orientation, grown outward from the nominal
 * hole boundary by `insetMm` so the extruded cut carries clearance on
 * the cavity's inside face. Callers extrude and 3D-cut these from the
 * bin body to produce an O-shape.
 */
export function buildMaskHoleDrawings(
  mask: CellMask,
  gridUnitMm: GridUnitInput,
  insetMm: number = CLEARANCE / 2
): Drawing[] {
  const loops = maskToPolygon(mask);
  if (loops.length <= 1) return [];

  const { x: unitX, y: unitY } = resolvePitch(gridUnitMm);
  const halfWidthMm = (mask.cols * MASK_CELL_SIZE * unitX) / 2;
  const halfDepthMm = (mask.rows * MASK_CELL_SIZE * unitY) / 2;

  const holes: Drawing[] = [];
  for (let i = 1; i < loops.length; i++) {
    // `maskToPolygon` returns holes CW (filled-on-left). Reverse to CCW
    // so the drawing represents the cavity region; then pass `-insetMm`
    // to grow the cavity outward into the filled material.
    const holeReversed = [...loops[i]].reverse();
    const holeMm = loopToMm(holeReversed, halfWidthMm, halfDepthMm, unitX, unitY);
    // Rounded corners inside a hole point toward the material-facing
    // edge, so use the standard BOX_CORNER_RADIUS here too.
    holes.push(buildLoopDrawing(holeMm, -insetMm, BOX_CORNER_RADIUS));
  }
  return holes;
}

/**
 * Outer polygon: perimeter inset by `CLEARANCE / 2` (matches `w - CLEARANCE`
 * of the rectangle path) with corners rounded to BOX_CORNER_RADIUS.
 *
 * @throws if the mask polygon has fewer than 3 vertices.
 */
export function buildMaskDrawing(mask: CellMask, gridUnitMm: GridUnitInput): Drawing {
  return buildMaskDrawingAtInset(mask, gridUnitMm, CLEARANCE / 2, BOX_CORNER_RADIUS);
}

/**
 * Inner polygon at additional `inset` beyond the clearance. Radius shrinks
 * linearly with the extra inset (mirroring the rectangular path's
 * `Math.max(BOX_CORNER_RADIUS - inset, …)`), so every section in a ruled
 * loft stays topologically consistent — same arc count at every Z level.
 */
export function buildMaskDrawingInset(
  mask: CellMask,
  gridUnitMm: GridUnitInput,
  inset: number
): Drawing {
  const radius = Math.max(BOX_CORNER_RADIUS - inset, MIN_ARC_RADIUS);
  return buildMaskDrawingAtInset(mask, gridUnitMm, CLEARANCE / 2 + inset, radius);
}
