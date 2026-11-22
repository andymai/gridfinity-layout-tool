/**
 * A path cutout's rings and the checks every point edit passes before it is
 * stored: the frame a pointer is turned into, the update an edited ring
 * becomes, and whether the generator still cuts the result as drawn.
 */

import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import { getPathBounds } from '../pathGeometry';
import { rotateAbout } from '@/shared/utils/cutoutOutline';
import { cuttablePolyline } from '@/shared/utils/pathCutoutOutline';
import { outlinesTouch, touchesItself } from '@/shared/utils/outlineSegments';
import { pointInPolygon } from '@/shared/scanTrace';

export type DragSource = Pick<Cutout, 'path' | 'holes' | 'rotation'>;

export function dragSource(cutout: Cutout): DragSource {
  return { path: cutout.path, holes: cutout.holes, rotation: cutout.rotation };
}

/** Compute cutout bound updates from an updated path. */
export function pathBoundsUpdate(path: readonly PathPoint[]): Partial<Cutout> {
  const { minX, minY, maxX, maxY } = getPathBounds(path);
  return { path: [...path], x: minX, y: minY, width: maxX - minX, depth: maxY - minY };
}

/**
 * Path points are stored unturned and drawn turned by the cutout's rotation
 * about its middle, so a pointer on the canvas is turned back before it
 * meets them.
 */
export function toPathFrame(cutout: Cutout, x: number, y: number): { x: number; y: number } {
  if (!cutout.rotation) return { x, y };
  const [px, py] = rotateAbout(
    x,
    y,
    cutout.x + cutout.width / 2,
    cutout.y + cutout.depth / 2,
    -cutout.rotation
  );
  return { x: px, y: py };
}

/** Where a stored, unturned path point is drawn on the canvas: the inverse of {@link toPathFrame}. */
export function toDrawnFrame(cutout: Cutout, x: number, y: number): { x: number; y: number } {
  if (!cutout.rotation) return { x, y };
  const [px, py] = rotateAbout(
    x,
    y,
    cutout.x + cutout.width / 2,
    cutout.y + cutout.depth / 2,
    cutout.rotation
  );
  return { x: px, y: py };
}

interface Laid {
  readonly points: Array<{ x: number; y: number }>;
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

const laidRings = new WeakMap<readonly PathPoint[], Laid | null>();

function area(points: readonly { x: number; y: number }[]): number {
  let sum = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    sum += (points[j].x + points[i].x) * (points[j].y - points[i].y);
  }
  return Math.abs(sum / 2);
}

/**
 * A ring as the builder cuts it, with its bounds, or null when it is not cut.
 * Stricter than the builder's own test: a ring with no area, or one meeting
 * itself where a point was dragged onto another, passes that test but has no
 * inside to cut.
 */
function laid(ring: readonly PathPoint[]): Laid | null {
  const known = laidRings.get(ring);
  if (known !== undefined) return known;
  const points = cuttablePolyline(ring);
  let result: Laid | null = null;
  if (points && area(points) > 1e-6 && !touchesItself(points)) {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    result = {
      points,
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    };
  }
  laidRings.set(ring, result);
  return result;
}

const boxesApart = (a: Laid, b: Laid): boolean =>
  a.maxX < b.minX || b.maxX < a.minX || a.maxY < b.minY || b.maxY < a.minY;

/**
 * Whether an island sits inside the outline without meeting it. One outside
 * cuts nothing, so it would vanish from the bin while the editor still drew it.
 */
function inside(outline: readonly PathPoint[], island: readonly PathPoint[]): boolean {
  const o = laid(outline);
  const i = laid(island);
  if (!o || !i) return false;
  if (i.minX < o.minX || i.maxX > o.maxX || i.minY < o.minY || i.maxY > o.maxY) return false;
  return pointInPolygon(i.points[0], o.points) && !outlinesTouch(i.points, o.points);
}

/** Whether two islands neither meet nor hold one another. */
function apart(a: readonly PathPoint[], b: readonly PathPoint[]): boolean {
  const p = laid(a);
  const q = laid(b);
  if (!p || !q) return false;
  if (boxesApart(p, q)) return true;
  return (
    !outlinesTouch(p.points, q.points) &&
    !pointInPolygon(p.points[0], q.points) &&
    !pointInPolygon(q.points[0], p.points)
  );
}

/**
 * Whether rings cut as drawn on their own: the outline and every island are
 * cut, each island sits inside the outline, and no two islands meet or hold
 * one another.
 */
export function cutsAsDrawn(rings: readonly (readonly PathPoint[])[]): boolean {
  const outline = rings.at(0);
  if (!outline || !laid(outline)) return false;
  const islands = rings.slice(1);
  return islands.every(
    (island, i) =>
      inside(outline, island) && islands.every((other, j) => j <= i || apart(island, other))
  );
}

/**
 * Whether an edit to ring `ring` leaves a cutout the generator cuts as drawn:
 * the ring is one it keeps, and no island that was inside the outline, or
 * apart from another island, stops being so. An island already out can still
 * be edited, so it can be brought back in. An outline edit moves every island
 * alike, so only their places in it are checked; an island edit, only its own.
 */
export function keepsShape(
  before: readonly (readonly PathPoint[])[],
  after: readonly (readonly PathPoint[])[],
  ring: number
): boolean {
  const edited = after.at(ring);
  if (!edited) return false;
  // A ring that was already not cut may still be edited, so it can be mended.
  const was = before.at(ring);
  if (!laid(edited) && (!was || laid(was))) return false;
  const holds = (k: number): boolean => inside(after[0], after[k]) || !inside(before[0], before[k]);
  if (ring === 0) return after.every((_, k) => k === 0 || holds(k));
  return (
    holds(ring) &&
    after.every(
      (other, k) =>
        k === 0 || k === ring || apart(after[ring], other) || !apart(before[ring], before[k])
    )
  );
}

function samePoint(a: PathPoint, b: PathPoint): boolean {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.symmetric === b.symmetric &&
    a.handleIn?.dx === b.handleIn?.dx &&
    a.handleIn?.dy === b.handleIn?.dy &&
    a.handleOut?.dx === b.handleOut?.dx &&
    a.handleOut?.dy === b.handleOut?.dy
  );
}

/**
 * Whether the rings or the turn changed since the drag began: an undo, a
 * remote edit or a pocket check's fix. The preview was built from the rings as
 * they were, so writing it back would undo that change or move the edit onto
 * another ring.
 */
export function changedSince(cutout: Cutout, from: DragSource | null | undefined): boolean {
  if (!from) return false;
  if (cutout.rotation !== from.rotation) return true;
  const now = ringsOf(cutout);
  const then = ringsOf(from);
  return (
    now.length !== then.length ||
    now.some(
      (ring, i) =>
        ring !== then[i] &&
        (ring.length !== then[i].length || ring.some((p, j) => !samePoint(p, then[i][j])))
    )
  );
}

export function ringsOf(cutout: Pick<Cutout, 'path' | 'holes'>): (readonly PathPoint[])[] {
  return [cutout.path ?? [], ...(cutout.holes ?? [])];
}

/**
 * A new outline for a turned cutout, shifted with its islands so every
 * point it did not move is drawn where it was. The cutout turns about the
 * middle of its outline's bounds, and an edit moves that middle: the shift
 * that keeps the turn's centre fixed is (R - I)(c' - c).
 */
function outlineEdit(
  cutout: Cutout,
  points: PathPoint[]
): { path: PathPoint[]; holes?: PathPoint[][] } {
  if (!cutout.rotation) return { path: points };
  const { minX, minY, maxX, maxY } = getPathBounds(points);
  const dx = (minX + maxX) / 2 - (cutout.x + cutout.width / 2);
  const dy = (minY + maxY) / 2 - (cutout.y + cutout.depth / 2);
  const [rx, ry] = rotateAbout(dx, dy, 0, 0, cutout.rotation);
  const sx = rx - dx;
  const sy = ry - dy;
  const move = (ring: readonly PathPoint[]) =>
    ring.map((p) => ({ ...p, x: p.x + sx, y: p.y + sy }));
  return { path: move(points), holes: cutout.holes?.map(move) };
}

export function ringPreview(cutout: Cutout, ring: number, points: PathPoint[]): Partial<Cutout> {
  if (ring === 0) {
    const { path, holes } = outlineEdit(cutout, points);
    return holes ? { path, holes } : { path };
  }
  const holes = [...(cutout.holes ?? [])];
  holes[ring - 1] = points;
  return { holes };
}

export function ringUpdate(cutout: Cutout, ring: number, points: PathPoint[]): Partial<Cutout> {
  if (ring > 0) return ringPreview(cutout, ring, points);
  const { path, holes } = outlineEdit(cutout, points);
  return holes ? { ...pathBoundsUpdate(path), holes } : pathBoundsUpdate(path);
}
