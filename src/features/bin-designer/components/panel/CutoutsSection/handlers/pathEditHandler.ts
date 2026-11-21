/**
 * Handler for the 'vertex-editing' interaction mode.
 *
 * Manages point selection (one point, a Shift-click set or a marquee),
 * dragging points, bezier handles, a selection's transform box and an edge
 * grabbed with falloff, segment splitting, and symmetry enforcement for path
 * cutouts. Every edit passes the ring checks in `pathRings` before it is
 * stored.
 */

import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import {
  isNearPoint,
  findNearestSegment,
  splitBezierSegment,
  updatePoint,
  enforceSymmetry,
  evaluateSegmentPoint,
} from '../pathGeometry';
import {
  changedSince,
  dragSource,
  keepsShape,
  pathBoundsUpdate,
  ringPreview,
  ringUpdate,
  ringsOf,
  toPathFrame,
} from './pathRings';
import { movePoints, normalizeSelection, pointsInRect, toggleIndex, type Rect } from './pointEdits';
import { transformPoints, type TransformHandle } from './pointTransform';
import { DEFAULT_FALLOFF_MM, falloffCommit, falloffPreview, startFalloff } from './falloffDrag';
import { countPointEdit, type PointEditTool } from './pointEditStats';
import {
  selectedIndices,
  withSelection,
  type VertexDragTarget,
  type VertexEditMode,
  type VertexEditSetters,
} from './vertexEditMode';
import type { PointerMoveEvent, BinBounds, SnapFn, SetModeFn } from './types';

export { dragSource, ringsOf, toPathFrame } from './pathRings';
export {
  selectedIndices,
  vertexEditingMode,
  withSelection,
  type SegmentHoverInfo,
  type VertexDragTarget,
  type VertexEditMode,
  type VertexEditSetters,
} from './vertexEditMode';

/** Clicks this close to a point pick it up; farther along an edge they add one. */
const VERTEX_PICK_MM = 2;

/** A press on an edge that moves farther than this, in mm, pulls it instead of adding a point. */
const EDGE_PULL_MM = 1;

/** A marquee smaller than this, in mm on each side, was a click. */
const MARQUEE_CLICK_MM = 0.5;

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
 * A press on a point. Shift adds it to the selection or takes it out. A press
 * on a point of a several-point selection drags them all; any other picks
 * that point alone and drags it.
 */
export function handleVertexDotDown(
  mode: VertexEditMode,
  cutout: Cutout,
  hit: { ring: number; index: number },
  shiftKey: boolean,
  setters: VertexEditSetters
): void {
  const { ring, index } = hit;
  const length = ringsOf(cutout).at(ring)?.length ?? 0;
  const current = ring === mode.ring ? normalizeSelection(selectedIndices(mode), length) : [];
  if (shiftKey) {
    setters.setMode({
      ...withSelection(mode, ring, toggleIndex(current, index), index),
      dragTarget: null,
    });
    return;
  }
  if (current.length > 1 && current.includes(index)) {
    setters.setMode({
      ...withSelection(mode, ring, current, index),
      dragTarget: { type: 'points', ring, index, indices: current },
      dragFrom: dragSource(cutout),
    });
    return;
  }
  setters.setMode({
    ...withSelection(mode, ring, [index]),
    dragTarget: { type: 'vertex', ring, index },
    dragFrom: dragSource(cutout),
  });
}

/**
 * Handle pointer down during vertex editing.
 *
 * Hit tests points, then the shown handles, then edges. A point or handle
 * starts a drag. An edge waits to see whether the pointer moves: a click adds
 * a point there, a drag pulls the edge. A miss starts a marquee, clearing the
 * selection unless Shift is held.
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
    handleVertexDotDown(mode, cutout, nearest, event.shiftKey === true, setters);
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
    setters.setMode({
      ...mode,
      dragTarget: {
        type: 'segment',
        ring: seg.ring,
        segmentIndex: seg.segmentIndex,
        t: seg.t,
        startX: event.mmX,
        startY: event.mmY,
      },
      dragFrom: dragSource(cutout),
    });
    return;
  }

  const additive = event.shiftKey === true;
  setters.setMode({
    ...(additive ? mode : { ...mode, selectedPointIndex: null, selectedPoints: undefined }),
    dragTarget: {
      type: 'marquee',
      ring: mode.ring,
      startX: event.mmX,
      startY: event.mmY,
      x: event.mmX,
      y: event.mmY,
      additive,
    },
  });
}

/** Start dragging the selection's transform box by one of its handles. */
export function handleTransformDown(
  mode: VertexEditMode,
  cutout: Cutout,
  handle: TransformHandle,
  box: Rect,
  event: PointerMoveEvent,
  setMode: SetModeFn
): void {
  const length = ringsOf(cutout).at(mode.ring)?.length ?? 0;
  const indices = normalizeSelection(selectedIndices(mode), length);
  if (indices.length < 2) return;
  setMode({
    ...mode,
    dragTarget: {
      type: 'transform',
      ring: mode.ring,
      indices,
      handle,
      box,
      startX: event.mmX,
      startY: event.mmY,
    },
    dragFrom: dragSource(cutout),
  });
}

/** Add a point where an edge was clicked, as long as the ring still cuts as drawn. */
function insertPoint(
  mode: VertexEditMode,
  cutout: Cutout,
  target: Extract<VertexDragTarget, { type: 'segment' }>,
  setters: VertexEditSetters
): void {
  const rings = ringsOf(cutout);
  const points = rings.at(target.ring);
  if (!points || target.segmentIndex >= points.length) return;
  const { before, mid, after } = splitBezierSegment(
    points[target.segmentIndex],
    points[(target.segmentIndex + 1) % points.length],
    target.t
  );

  const updated: PathPoint[] = [...points];
  updated[target.segmentIndex] = before;
  updated[(target.segmentIndex + 1) % points.length] = after;

  const insertIdx = target.segmentIndex + 1;
  updated.splice(insertIdx, 0, mid);

  // Splitting moves the builder's samples along a curve, which can bring it
  // onto an island it cleared.
  const update = ringUpdate(cutout, target.ring, updated);
  if (keepsShape(rings, ringsOf({ ...cutout, ...update }), target.ring)) {
    setters.onUpdate(cutout.id, update);
    countPointEdit('add');
    setters.setMode({ ...withSelection(mode, target.ring, [insertIdx]), dragTarget: null });
    return;
  }
  setters.setMode({ ...withSelection(mode, mode.ring, []), dragTarget: null });
}

// ── Pointer Move ─────────────────────────────────────────────────────────────

/** Threshold in mm for segment hover detection. */
const SEGMENT_HOVER_THRESHOLD = 5;

/** The pointer kept in the bin as drawn, snapped, then turned into the path's frame. */
function snappedInPath(
  cutout: Cutout,
  event: PointerMoveEvent,
  bounds: BinBounds,
  snap: SnapFn
): { x: number; y: number } {
  return toPathFrame(
    cutout,
    Math.max(0, Math.min(snap(event.mmX), bounds.binWidth)),
    Math.max(0, Math.min(snap(event.mmY), bounds.binDepth))
  );
}

/** How far the pointer has moved since (startX, startY), in the path's frame. */
function pathDelta(cutout: Cutout, startX: number, startY: number, event: PointerMoveEvent) {
  const from = toPathFrame(cutout, startX, startY);
  const to = toPathFrame(cutout, event.mmX, event.mmY);
  return { dx: to.x - from.x, dy: to.y - from.y };
}

/**
 * Handle pointer move during vertex editing.
 *
 * Drags the active point, handle, selection or pulled edge, applying snap and
 * clamping to a point. For handles, enforces symmetry unless alt is held
 * (which breaks it).
 */
export function handleVertexEditPointerMove(
  mode: VertexEditMode,
  event: PointerMoveEvent,
  cutout: Cutout,
  bounds: BinBounds,
  snap: SnapFn,
  setters: Pick<VertexEditSetters, 'setPreview' | 'setSegmentHover' | 'setMode'>
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
  if (dragTarget.type === 'marquee') {
    setters.setMode({ ...mode, dragTarget: { ...dragTarget, x: event.mmX, y: event.mmY } });
    return;
  }

  // An island the drag began on can also vanish without a recorded source;
  // see the stale-index note below.
  const path = rings.at(dragTarget.ring);
  if (!path || changedSince(cutout, mode.dragFrom)) {
    setters.setPreview(new Map());
    return;
  }
  const show = (points: PathPoint[]) =>
    setters.setPreview(new Map([[cutout.id, ringPreview(cutout, dragTarget.ring, points)]]));

  switch (dragTarget.type) {
    case 'segment': {
      const moved = Math.hypot(event.mmX - dragTarget.startX, event.mmY - dragTarget.startY);
      if (moved < EDGE_PULL_MM) return;
      const radius = mode.falloffMm ?? DEFAULT_FALLOFF_MM;
      const grab = startFalloff(path, dragTarget.segmentIndex, dragTarget.t, radius);
      if (!grab) return;
      const { dx, dy } = pathDelta(cutout, dragTarget.startX, dragTarget.startY, event);
      const { ring, startX, startY } = dragTarget;
      setters.setMode({
        ...mode,
        dragTarget: { type: 'falloff', ring, grab, startX, startY, dx, dy },
      });
      show(falloffPreview(path, grab, dx, dy));
      return;
    }
    case 'falloff': {
      const { dx, dy } = pathDelta(cutout, dragTarget.startX, dragTarget.startY, event);
      setters.setMode({ ...mode, dragTarget: { ...dragTarget, dx, dy } });
      show(falloffPreview(path, dragTarget.grab, dx, dy));
      return;
    }
    case 'points': {
      const grabbed = path.at(dragTarget.index);
      if (!grabbed) {
        setters.setPreview(new Map());
        return;
      }
      const to = snappedInPath(cutout, event, bounds, snap);
      show(movePoints(path, dragTarget.indices, to.x - grabbed.x, to.y - grabbed.y));
      return;
    }
    case 'transform': {
      const to = { x: event.mmX, y: event.mmY };
      show(
        transformPoints(cutout, path, dragTarget.indices, dragTarget, to, event.shiftKey === true)
      );
      return;
    }
    case 'vertex': {
      show(updatePoint(path, dragTarget.index, snappedInPath(cutout, event, bounds, snap)));
      return;
    }
    case 'handle': {
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

      let updatedPoint: PathPoint =
        dragTarget.handleType === 'in'
          ? { ...pt, handleIn: { dx, dy } }
          : { ...pt, handleOut: { dx, dy } };

      // Alt key breaks symmetry; otherwise enforce it
      if (event.altKey) {
        updatedPoint = { ...updatedPoint, symmetric: false };
      } else if (updatedPoint.symmetric) {
        updatedPoint = enforceSymmetry(updatedPoint, dragTarget.handleType);
      }

      show(updatePoint(path, dragTarget.index, updatedPoint));
      return;
    }
  }
}

// ── Pointer Up ───────────────────────────────────────────────────────────────

/** The tool each committed drag counts as. */
const DRAG_TOOL: Record<Exclude<VertexDragTarget['type'], 'marquee' | 'segment'>, PointEditTool> = {
  vertex: 'move',
  handle: 'handle',
  points: 'move_many',
  transform: 'transform',
  falloff: 'pull',
};

/** Select what a marquee holds, added to the selection when it was drawn with Shift. */
function finishMarquee(
  mode: VertexEditMode,
  cutout: Cutout,
  target: Extract<VertexDragTarget, { type: 'marquee' }>,
  setMode: SetModeFn
): void {
  const rect = {
    minX: Math.min(target.startX, target.x),
    minY: Math.min(target.startY, target.y),
    maxX: Math.max(target.startX, target.x),
    maxY: Math.max(target.startY, target.y),
  };
  const clicked =
    rect.maxX - rect.minX < MARQUEE_CLICK_MM && rect.maxY - rect.minY < MARQUEE_CLICK_MM;
  const hit = clicked ? null : pointsInRect(cutout, rect);
  if (!hit) {
    setMode({ ...mode, dragTarget: null });
    return;
  }
  const length = ringsOf(cutout).at(hit.ring)?.length ?? 0;
  const kept = target.additive && hit.ring === mode.ring ? selectedIndices(mode) : [];
  const indices = normalizeSelection([...kept, ...hit.indices], length);
  setMode({ ...withSelection(mode, hit.ring, indices), dragTarget: null });
}

/**
 * Handle pointer up during vertex editing.
 *
 * Commits the preview path changes and clears the drag target. A pulled edge
 * is fitted again first, so it is stored with few points, not as the dense
 * stretch the preview drew.
 */
export function handleVertexEditPointerUp(
  mode: VertexEditMode,
  cutout: Cutout,
  preview: ReadonlyMap<string, Partial<Cutout>>,
  setters: VertexEditSetters
): void {
  const target = mode.dragTarget;
  if (target?.type === 'marquee') {
    finishMarquee(mode, cutout, target, setters.setMode);
    return;
  }
  if (target?.type === 'segment') {
    if (!changedSince(cutout, mode.dragFrom)) {
      insertPoint({ ...mode, dragFrom: null }, cutout, target, setters);
    } else {
      setters.setMode({ ...mode, dragTarget: null, dragFrom: null });
    }
    return;
  }

  let after: (readonly PathPoint[])[] | null = null;
  let holes: PathPoint[][] | undefined;
  if (target && !changedSince(cutout, mode.dragFrom)) {
    if (target.type === 'falloff') {
      const path = ringsOf(cutout).at(target.ring);
      const fitted = path ? falloffCommit(path, target.grab, target.dx, target.dy) : null;
      if (fitted) {
        const update = ringUpdate(cutout, target.ring, fitted);
        after = ringsOf({ ...cutout, ...update });
        holes = update.holes;
      }
    } else {
      const previewUpdates = preview.get(cutout.id);
      if (previewUpdates) {
        after = ringsOf({ ...cutout, ...previewUpdates });
        holes = previewUpdates.holes;
      }
    }
  }
  if (target && after && keepsShape(ringsOf(cutout), after, target.ring)) {
    // The update already holds the edit as it is to be stored, an outline's
    // shift for a turned cutout included.
    setters.onUpdate(
      cutout.id,
      target.ring === 0 ? { ...pathBoundsUpdate(after[0]), ...(holes ? { holes } : {}) } : { holes }
    );
    countPointEdit(DRAG_TOOL[target.type]);
  }

  // Clear preview and drag target. A pulled edge is fitted into new points,
  // so the old indices name nothing; every other drag keeps its selection.
  setters.setPreview(new Map());
  const next = target?.type === 'falloff' ? withSelection(mode, mode.ring, []) : mode;
  setters.setMode({
    ...next,
    dragTarget: null,
    dragFrom: null,
  });
}
