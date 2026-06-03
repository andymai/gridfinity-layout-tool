/**
 * Pure geometry for regular-polygon and slot (stadium) cutouts.
 *
 * Lives in `shared/` so both the generation worker (`cutoutBuilder`) and the
 * 2D editor (`CutoutsSection`) derive identical outlines from the same source.
 *
 * Coordinate convention matches the rest of the cutout system: mm, Y-up. A
 * polygon's vertices are scaled to fill its `width × depth` bounding box
 * exactly, so every bounds/resize/rotation helper that reasons in width×depth
 * space keeps working unchanged — only the outline itself knows it's an N-gon.
 */

// Import via the shared barrel (not @/features/*) so this shared utility never
// reaches into a feature — keeps the features → shared → core direction intact.
import { MIN_POLYGON_SIDES, MAX_POLYGON_SIDES } from '@/shared/types/bin';

export interface PolygonPoint {
  readonly x: number;
  readonly y: number;
}

/** Clamp + round a requested side count into the supported polygon range. */
export function clampPolygonSides(sides: number): number {
  if (!Number.isFinite(sides)) return MIN_POLYGON_SIDES;
  return Math.max(MIN_POLYGON_SIDES, Math.min(MAX_POLYGON_SIDES, Math.round(sides)));
}

/**
 * Unit (circumradius 1) regular-polygon vertices, oriented "flat-top": for even
 * side counts a horizontal edge sits at the top and bottom, so hexagons nest
 * into tight offset rows. Returned in CCW order.
 *
 * The top edge is centered at +Y by placing an edge midpoint at +90°, i.e.
 * starting the vertex sweep at `90° − 180°/N`.
 */
function unitPolygonVertices(sides: number): PolygonPoint[] {
  const n = clampPolygonSides(sides);
  const base = Math.PI / 2 - Math.PI / n;
  const step = (2 * Math.PI) / n;
  const verts: PolygonPoint[] = [];
  for (let i = 0; i < n; i++) {
    const a = base + i * step;
    verts.push({ x: Math.cos(a), y: Math.sin(a) });
  }
  return verts;
}

interface Bbox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

function boundsOf(points: readonly PolygonPoint[]): Bbox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Vertices of a regular polygon centered at the origin, scaled to fill the
 * given `width × depth` bounding box exactly. CCW order. Degenerate sizes
 * (≤0) yield an empty array so callers can fall back.
 */
export function regularPolygonPoints(sides: number, width: number, depth: number): PolygonPoint[] {
  if (width <= 0 || depth <= 0) return [];
  const unit = unitPolygonVertices(sides);
  const b = boundsOf(unit);
  const uw = b.maxX - b.minX;
  const uh = b.maxY - b.minY;
  if (uw <= 0 || uh <= 0) return [];
  const ucx = (b.minX + b.maxX) / 2;
  const ucy = (b.minY + b.maxY) / 2;
  const sx = width / uw;
  const sy = depth / uh;
  return unit.map((p) => ({ x: (p.x - ucx) * sx, y: (p.y - ucy) * sy }));
}

/**
 * Width-to-depth aspect ratio of a regular polygon in flat-top orientation
 * (≈1.1547 for a hexagon: point-to-point is wider than flat-to-flat).
 */
function polygonAspect(sides: number): number {
  const b = boundsOf(unitPolygonVertices(sides));
  const uw = b.maxX - b.minX;
  const uh = b.maxY - b.minY;
  return uh > 0 ? uw / uh : 1;
}

/**
 * Width × depth bounding box for a *regular* polygon with the given across-flats
 * distance. Across-flats is the flat-to-flat span, which in the flat-top
 * orientation is the vertical (depth) extent; the horizontal (width) extent is
 * derived from the polygon's natural aspect ratio so the result is regular.
 */
export function polygonBoxFromAcrossFlats(
  sides: number,
  acrossFlats: number
): { width: number; depth: number } {
  const safeAf = Math.max(0, acrossFlats);
  return { width: safeAf * polygonAspect(sides), depth: safeAf };
}

/**
 * Largest across-flats that keeps a *regular* polygon inside both bin
 * dimensions. Because a flat-top polygon is wider than it is tall, the width
 * (not just the depth) can be the binding constraint — so cap by both, which
 * prevents the box from being clamped on one axis and distorted into an
 * irregular shape.
 */
export function maxAcrossFlats(sides: number, maxWidth: number, maxDepth: number): number {
  const aspect = polygonAspect(sides);
  const widthLimited = aspect > 0 ? maxWidth / aspect : maxWidth;
  return Math.max(0, Math.min(maxDepth, widthLimited));
}

/**
 * Across-flats distance implied by a polygon's current bounding box. Inverse of
 * {@link polygonBoxFromAcrossFlats} for the depth axis — used to populate the
 * editor field as the user resizes.
 */
export function acrossFlatsFromBox(_sides: number, depth: number): number {
  return Math.max(0, depth);
}

/**
 * Corner radius that turns a `width × depth` rectangle into a slot (stadium):
 * always half the short side so the ends are fully rounded semicircles.
 */
export function slotCornerRadius(width: number, depth: number): number {
  return Math.max(0, Math.min(width, depth) / 2);
}

export { MIN_POLYGON_SIDES, MAX_POLYGON_SIDES };
