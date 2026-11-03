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
  isSelfIntersecting,
} from '../pathGeometry';
import { rotateAbout } from '@/shared/utils/cutoutOutline';
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
 * A ring the generator keeps: two straight anchors bound nothing, and a ring
 * crossing itself is dropped, which would leave an island's pocket cut through.
 */
function keepsShape(points: readonly PathPoint[]): boolean {
  const curved = points.some((p) => p.handleIn !== null || p.handleOut !== null);
  return (points.length >= 3 || curved) && !isSelfIntersecting(points);
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

  const pick = Math.min(threshold, VERTEX_PICK_MM);
  let nearest: { ring: number; index: number; d: number } | null = null;
  for (let ring = 0; ring < rings.length; ring++) {
    for (let index = 0; index < rings[ring].length; index++) {
      const pt = rings[ring][index];
      const d = Math.hypot(pt.x - at.x, pt.y - at.y);
      if (d <= pick && (!nearest || d < nearest.d)) nearest = { ring, index, d };
    }
  }
  if (nearest) {
    const { ring, index } = nearest;
    setters.setMode({
      ...mode,
      ring,
      selectedPointIndex: index,
      dragTarget: { type: 'vertex', ring, index },
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

    setters.onUpdate(cutout.id, ringUpdate(cutout, seg.ring, updated));
    setters.setMode({ ...mode, ring: seg.ring, selectedPointIndex: insertIdx, dragTarget: null });
    return;
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
  // An island the drag began on can vanish mid-drag (an undo, a remote edit);
  // see the stale-index note below.
  const path = rings.at(dragTarget.ring);
  if (!path) {
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
  const ring = mode.dragTarget?.ring ?? 0;
  // A preview carrying islands (any island drag, or an outline drag on a
  // turned cutout) holds them as of the last move; if they have changed
  // since, writing it back would restore a removed one or move the edit onto
  // another.
  const islandsChanged =
    previewUpdates?.holes !== undefined &&
    previewUpdates.holes.length !== (cutout.holes?.length ?? 0);
  const moved = previewUpdates ? ringsOf({ ...cutout, ...previewUpdates }).at(ring) : undefined;
  if (previewUpdates && moved && !islandsChanged && keepsShape(moved)) {
    // The preview already holds the edit as it is to be stored, an outline's
    // shift for a turned cutout included.
    setters.onUpdate(
      cutout.id,
      ring === 0
        ? {
            ...pathBoundsUpdate(moved),
            ...(previewUpdates.holes ? { holes: previewUpdates.holes } : {}),
          }
        : { holes: previewUpdates.holes }
    );
  }

  // Clear preview and drag target, keep selection
  setters.setPreview(new Map());
  setters.setMode({
    ...mode,
    dragTarget: null,
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
      if (mode.selectedPointIndex === null) return;
      // An index past the end splices nothing, so the "updated" path came back
      // identical and was committed anyway — an undo entry that undoes to
      // itself. The path shrinks outside this handler, so the index can lead.
      if (mode.selectedPointIndex >= path.length) return;

      const updated = removePoint(path, mode.selectedPointIndex);
      if (!updated || !keepsShape(updated)) return;

      event.preventDefault();
      setters.onUpdate(cutout.id, ringUpdate(cutout, mode.ring, updated));

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
