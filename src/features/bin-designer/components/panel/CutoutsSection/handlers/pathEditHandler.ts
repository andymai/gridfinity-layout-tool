/**
 * Handler for the 'vertex-editing' interaction mode.
 *
 * Manages vertex selection, dragging vertices and bezier handles,
 * segment splitting, point deletion, and symmetry enforcement
 * for path cutouts.
 */

import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import {
  isNearPoint,
  findNearestSegment,
  splitBezierSegment,
  removePoint,
  updatePoint,
  enforceSymmetry,
  getPathBounds,
  evaluateSegmentPoint,
} from '../pathGeometry';
import { rotateAbout } from '@/shared/utils/cutoutOutline';
import { cuttablePolyline } from '@/shared/utils/pathCutoutOutline';
import { outlinesTouch, touchesItself } from '@/shared/utils/outlineSegments';
import { pointInPolygon } from '@/shared/scanTrace';
import type { PointerMoveEvent, BinBounds, SnapFn, PreviewSetters, SetModeFn } from './types';

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Target being dragged during vertex editing. `ring` 0 is the outline and
 * ring k the cutout's island k - 1.
 */
export type VertexDragTarget =
  | { readonly type: 'vertex'; readonly ring: number; readonly index: number }
  | {
      readonly type: 'handle';
      readonly ring: number;
      readonly index: number;
      readonly handleType: 'in' | 'out';
    };

/** Mode state for vertex editing, entered by double-clicking a path cutout. */
export interface VertexEditMode {
  readonly type: 'vertex-editing';
  readonly cutoutId: string;
  /** The ring the selected point is on, as in `VertexDragTarget`. */
  readonly ring: number;
  readonly selectedPointIndex: number | null;
  readonly dragTarget: VertexDragTarget | null;
  /** The rings and turn the drag began from, to tell when they change under it. */
  readonly dragFrom?: DragSource | null;
}

export type DragSource = Pick<Cutout, 'path' | 'holes' | 'rotation'>;

export function dragSource(cutout: Cutout): DragSource {
  return { path: cutout.path, holes: cutout.holes, rotation: cutout.rotation };
}

/** Info about the segment the cursor is hovering near (for add-point preview). */
export interface SegmentHoverInfo {
  readonly ring: number;
  readonly segmentIndex: number;
  readonly t: number;
  readonly x: number;
  readonly y: number;
}

/** Callbacks the vertex edit handlers use to update state. */
export interface VertexEditSetters {
  readonly setMode: SetModeFn;
  readonly setPreview: PreviewSetters['setPreview'];
  readonly onUpdate: (id: string, updates: Partial<Cutout>) => void;
  readonly setSegmentHover: (hover: SegmentHoverInfo | null) => void;
}

/** Compute cutout bound updates from an updated path. */
function pathBoundsUpdate(path: readonly PathPoint[]): Partial<Cutout> {
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

/** Clicks this close to a point pick it up; farther along an edge they add one. */
const VERTEX_PICK_MM = 2;

/**
 * The point on any ring nearest a canvas position, within `reach`. A press
 * on overlapping handles takes this rather than whichever handle was hit first.
 */
export function nearestPoint(
  cutout: Cutout,
  x: number,
  y: number,
  reach = Infinity
): { ring: number; index: number } | null {
  const at = toPathFrame(cutout, x, y);
  const rings = ringsOf(cutout);
  let best: { ring: number; index: number; d: number } | null = null;
  for (let ring = 0; ring < rings.length; ring++) {
    for (let index = 0; index < rings[ring].length; index++) {
      const pt = rings[ring][index];
      const d = Math.hypot(pt.x - at.x, pt.y - at.y);
      if (d <= reach && (!best || d < best.d)) best = { ring, index, d };
    }
  }
  return best && { ring: best.ring, index: best.index };
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
 * Whether an edit to ring `ring` leaves a cutout the generator cuts as drawn:
 * the ring is one it keeps, and no island that was inside the outline, or
 * apart from another island, stops being so. An island already out can still
 * be edited, so it can be brought back in. An outline edit moves every island
 * alike, so only their places in it are checked; an island edit, only its own.
 */
function keepsShape(
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
function changedSince(cutout: Cutout, from: DragSource | null | undefined): boolean {
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

function ringPreview(cutout: Cutout, ring: number, points: PathPoint[]): Partial<Cutout> {
  if (ring === 0) {
    const { path, holes } = outlineEdit(cutout, points);
    return holes ? { path, holes } : { path };
  }
  const holes = [...(cutout.holes ?? [])];
  holes[ring - 1] = points;
  return { holes };
}

function ringUpdate(cutout: Cutout, ring: number, points: PathPoint[]): Partial<Cutout> {
  if (ring > 0) return ringPreview(cutout, ring, points);
  const { path, holes } = outlineEdit(cutout, points);
  return holes ? { ...pathBoundsUpdate(path), holes } : pathBoundsUpdate(path);
}

function nearestSegment(
  x: number,
  y: number,
  rings: readonly (readonly PathPoint[])[],
  threshold: number
): { ring: number; segmentIndex: number; t: number } | null {
  let best: { ring: number; segmentIndex: number; t: number; d: number } | null = null;
  rings.forEach((points, ring) => {
    const seg = findNearestSegment(x, y, points, threshold);
    if (!seg) return;
    const at = evaluateSegmentPoint(points, seg.segmentIndex, seg.t);
    const d = Math.hypot(at.x - x, at.y - y);
    if (!best || d < best.d) best = { ring, ...seg, d };
  });
  return best;
}

// ── Pointer Down ─────────────────────────────────────────────────────────────

/**
 * Handle pointer down during vertex editing.
 *
 * Hit tests vertices, then handles, then segments. On vertex/handle hit,
 * starts a drag. On segment hit, inserts a new point via bezier splitting.
 * On miss, deselects the current vertex.
 */
export function handleVertexEditPointerDown(
  mode: VertexEditMode,
  event: PointerMoveEvent,
  cutout: Cutout,
  threshold: number,
  setters: VertexEditSetters
): void {
  const rings = ringsOf(cutout);
  if (rings[0].length === 0) return;
  const at = toPathFrame(cutout, event.mmX, event.mmY);

  // Clear hover on any pointer down
  setters.setSegmentHover(null);

  const nearest = nearestPoint(cutout, event.mmX, event.mmY, Math.min(threshold, VERTEX_PICK_MM));
  if (nearest) {
    const { ring, index } = nearest;
    setters.setMode({
      ...mode,
      ring,
      selectedPointIndex: index,
      dragTarget: { type: 'vertex', ring, index },
      dragFrom: dragSource(cutout),
    });
    return;
  }

  // The index can outlive the point it named: the path shrinks whenever a
  // vertex is deleted, an undo lands, or a remote edit arrives, and none of
  // those go through this handler. Reading past the end here threw a
  // TypeError and took the editor down with it, so a stale index is treated
  // as no selection and the click falls through to the segment test below.
  const selectedPoint =
    mode.selectedPointIndex === null ? undefined : rings.at(mode.ring)?.[mode.selectedPointIndex];

  if (selectedPoint !== undefined && mode.selectedPointIndex !== null) {
    const pt = selectedPoint;
    const selectedIndex = mode.selectedPointIndex;

    if (pt.handleIn) {
      const hx = pt.x + pt.handleIn.dx;
      const hy = pt.y + pt.handleIn.dy;
      if (isNearPoint(at.x, at.y, hx, hy, threshold)) {
        setters.setMode({
          ...mode,
          dragTarget: { type: 'handle', ring: mode.ring, index: selectedIndex, handleType: 'in' },
          dragFrom: dragSource(cutout),
        });
        return;
      }
    }

    if (pt.handleOut) {
      const hx = pt.x + pt.handleOut.dx;
      const hy = pt.y + pt.handleOut.dy;
      if (isNearPoint(at.x, at.y, hx, hy, threshold)) {
        setters.setMode({
          ...mode,
          dragTarget: { type: 'handle', ring: mode.ring, index: selectedIndex, handleType: 'out' },
          dragFrom: dragSource(cutout),
        });
        return;
      }
    }
  }

  const seg = nearestSegment(at.x, at.y, rings, threshold);
  if (seg) {
    const points = rings[seg.ring];
    const { before, mid, after } = splitBezierSegment(
      points[seg.segmentIndex],
      points[(seg.segmentIndex + 1) % points.length],
      seg.t
    );

    const updated: PathPoint[] = [...points];
    updated[seg.segmentIndex] = before;
    updated[(seg.segmentIndex + 1) % points.length] = after;

    const insertIdx = seg.segmentIndex + 1;
    updated.splice(insertIdx, 0, mid);

    // Splitting moves the builder's samples along a curve, which can bring it
    // onto an island it cleared.
    const update = ringUpdate(cutout, seg.ring, updated);
    if (keepsShape(rings, ringsOf({ ...cutout, ...update }), seg.ring)) {
      setters.onUpdate(cutout.id, update);
      setters.setMode({ ...mode, ring: seg.ring, selectedPointIndex: insertIdx, dragTarget: null });
      return;
    }
  }

  setters.setMode({ ...mode, selectedPointIndex: null, dragTarget: null });
}

// ── Pointer Move ─────────────────────────────────────────────────────────────

/**
 * Handle pointer move during vertex editing.
 *
 * Drags the active vertex or handle, applying snap and clamping.
 * For handles, enforces symmetry unless alt is held (which breaks it).
 */
/** Threshold in mm for segment hover detection. */
const SEGMENT_HOVER_THRESHOLD = 5;

export function handleVertexEditPointerMove(
  mode: VertexEditMode,
  event: PointerMoveEvent,
  cutout: Cutout,
  bounds: BinBounds,
  snap: SnapFn,
  setters: Pick<VertexEditSetters, 'setPreview' | 'setSegmentHover'>
): void {
  const rings = ringsOf(cutout);
  if (rings[0].length === 0) return;

  // When not dragging, compute segment hover for add-point preview
  if (!mode.dragTarget) {
    const at = toPathFrame(cutout, event.mmX, event.mmY);
    const seg = nearestSegment(at.x, at.y, rings, SEGMENT_HOVER_THRESHOLD);
    if (seg) {
      const pt = evaluateSegmentPoint(rings[seg.ring], seg.segmentIndex, seg.t);
      setters.setSegmentHover({ ...seg, x: pt.x, y: pt.y });
    } else {
      setters.setSegmentHover(null);
    }
    return;
  }

  const { dragTarget } = mode;
  // An island the drag began on can also vanish without a recorded source;
  // see the stale-index note below.
  const path = rings.at(dragTarget.ring);
  if (!path || changedSince(cutout, mode.dragFrom)) {
    setters.setPreview(new Map());
    return;
  }

  if (dragTarget.type === 'vertex') {
    // Snapped and kept in the bin as drawn, then turned into the path's frame.
    const { x, y } = toPathFrame(
      cutout,
      Math.max(0, Math.min(snap(event.mmX), bounds.binWidth)),
      Math.max(0, Math.min(snap(event.mmY), bounds.binDepth))
    );

    const updatedPath = updatePoint(path, dragTarget.index, { x, y });

    setters.setPreview(new Map([[cutout.id, ringPreview(cutout, dragTarget.ring, updatedPath)]]));
  } else {
    // Same stale-index hazard as the pointer-down hit test: the path can
    // shrink mid-drag (an undo, a remote edit), and reading past its end threw
    // rather than simply dropping the frame.
    const pt = path.at(dragTarget.index);
    if (pt === undefined) {
      // Dropping the frame is not enough. The last preview was computed
      // against the longer path and pointer-up commits whatever it finds, so
      // leaving it would put the removed points back and overwrite whatever
      // shrank the path.
      setters.setPreview(new Map());
      return;
    }
    // Clamp handle endpoint to bin bounds
    const end = toPathFrame(
      cutout,
      Math.max(0, Math.min(event.mmX, bounds.binWidth)),
      Math.max(0, Math.min(event.mmY, bounds.binDepth))
    );
    const dx = end.x - pt.x;
    const dy = end.y - pt.y;

    let updatedPoint: PathPoint;

    if (dragTarget.handleType === 'in') {
      updatedPoint = { ...pt, handleIn: { dx, dy } };
    } else {
      updatedPoint = { ...pt, handleOut: { dx, dy } };
    }

    // Alt key breaks symmetry; otherwise enforce it
    if (event.altKey) {
      updatedPoint = { ...updatedPoint, symmetric: false };
    } else if (updatedPoint.symmetric) {
      updatedPoint = enforceSymmetry(updatedPoint, dragTarget.handleType);
    }

    const updatedPath = updatePoint(path, dragTarget.index, updatedPoint);

    setters.setPreview(new Map([[cutout.id, ringPreview(cutout, dragTarget.ring, updatedPath)]]));
  }
}

// ── Pointer Up ───────────────────────────────────────────────────────────────

/**
 * Handle pointer up during vertex editing.
 *
 * Commits the preview path changes and clears the drag target.
 */
export function handleVertexEditPointerUp(
  mode: VertexEditMode,
  cutout: Cutout,
  preview: ReadonlyMap<string, Partial<Cutout>>,
  setters: VertexEditSetters
): void {
  const previewUpdates = preview.get(cutout.id);
  const target = mode.dragTarget;
  if (target && previewUpdates && !changedSince(cutout, mode.dragFrom)) {
    const after = ringsOf({ ...cutout, ...previewUpdates });
    if (keepsShape(ringsOf(cutout), after, target.ring)) {
      // The preview already holds the edit as it is to be stored, an outline's
      // shift for a turned cutout included.
      setters.onUpdate(
        cutout.id,
        target.ring === 0
          ? {
              ...pathBoundsUpdate(after[0]),
              ...(previewUpdates.holes ? { holes: previewUpdates.holes } : {}),
            }
          : { holes: previewUpdates.holes }
      );
    }
  }

  // Clear preview and drag target, keep selection
  setters.setPreview(new Map());
  setters.setMode({
    ...mode,
    dragTarget: null,
    dragFrom: null,
  });
}

// ── Keyboard ─────────────────────────────────────────────────────────────────

/**
 * Handle keydown events during vertex editing.
 *
 * - Delete/Backspace: remove the selected vertex (down to MIN_PATH_POINTS anchors)
 * - Escape: exit vertex editing mode
 */
export function handleVertexEditKeyDown(
  event: KeyboardEvent,
  mode: VertexEditMode,
  cutout: Cutout,
  setters: VertexEditSetters
): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    setters.setMode({ type: 'idle' });
    return;
  }
  const path = ringsOf(cutout).at(mode.ring);
  if (!path) return;

  switch (event.key) {
    case 'Delete':
    case 'Backspace': {
      // A drag in progress would write its preview over the deletion on release.
      if (mode.selectedPointIndex === null || mode.dragTarget) return;
      // An index past the end splices nothing, so the "updated" path came back
      // identical and was committed anyway — an undo entry that undoes to
      // itself. The path shrinks outside this handler, so the index can lead.
      if (mode.selectedPointIndex >= path.length) return;

      const updated = removePoint(path, mode.selectedPointIndex);
      if (!updated) return;
      const update = ringUpdate(cutout, mode.ring, updated);
      if (!keepsShape(ringsOf(cutout), ringsOf({ ...cutout, ...update }), mode.ring)) return;

      event.preventDefault();
      setters.onUpdate(cutout.id, update);

      // Adjust selection index: if we removed the last point, select the new last
      const newIndex =
        mode.selectedPointIndex >= updated.length ? updated.length - 1 : mode.selectedPointIndex;
      setters.setMode({
        ...mode,
        selectedPointIndex: newIndex,
        dragTarget: null,
      });
      break;
    }
  }
}
