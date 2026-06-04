/**
 * Handler for the 'path-drawing' interaction mode (pen tool).
 *
 * Manages multi-click path creation with bezier handle support.
 * Each click adds a corner point; dragging after click creates
 * symmetric bezier handles. Closing the path (clicking near the
 * first point with MIN_PATH_POINTS+ points) commits the shape.
 */

import type { PathPoint } from '@/features/bin-designer/types';
import type { PointerMoveEvent, BinBounds, SnapFn } from './types';
import {
  cornerPoint,
  snapAngle45,
  isNearPoint,
  CLOSE_SNAP_THRESHOLD,
  MIN_PATH_POINTS,
  MAX_PATH_POINTS,
} from '../pathGeometry';

// ── Exported types ───────────────────────────────────────────────────────────

/** Mode state for pen tool drawing. */
export interface PathDrawingMode {
  readonly type: 'path-drawing';
  readonly points: readonly PathPoint[];
  /** True while the user is dragging (creating handles on the latest point). */
  readonly activePointDrag: boolean;
  /** Index of an existing point being repositioned (null = not repositioning). */
  readonly repositionIndex: number | null;
}

/** Preview state exposed to the rendering layer during path drawing. */
export interface PathDrawingPreviewState {
  readonly points: readonly PathPoint[];
  readonly cursorX: number;
  readonly cursorY: number;
  /** True when the cursor is close enough to the first point to close the path. */
  readonly canClose: boolean;
}

// ── Setters interface ────────────────────────────────────────────────────────

/** Callbacks the path drawing handler uses to push state into React. */
export interface PathDrawingSetters {
  readonly setMode: (mode: PathDrawingMode) => void;
  readonly setPathDrawingPreview: (preview: PathDrawingPreviewState | null) => void;
  /** Called when the path is closed and ready to be committed as a cutout. */
  readonly commitPath: (points: readonly PathPoint[]) => void;
}

// ── Pointer down ─────────────────────────────────────────────────────────────

/**
 * Handle pointer down during path drawing.
 *
 * - First click (no existing mode): creates the first corner point and
 *   transitions to path-drawing mode.
 * - Subsequent clicks: if near the first point (and MIN_PATH_POINTS+ exist),
 *   closes and commits the path. Otherwise appends a new corner point.
 * - Shift key constrains the new point angle to 45-degree increments
 *   relative to the last point.
 *
 * @param mode - Current path-drawing mode state, or null for the first click.
 * @param mmX - Cursor X in mm (bin-local coordinates).
 * @param mmY - Cursor Y in mm (bin-local coordinates).
 * @param shiftKey - Whether the Shift modifier is held.
 * @param bounds - Bin boundary dimensions for clamping.
 * @param snap - Snap function respecting the current snap-enabled state.
 * @param setters - Callbacks to push state changes.
 */
export function handlePathDrawingPointerDown(
  mode: PathDrawingMode | null,
  mmX: number,
  mmY: number,
  shiftKey: boolean,
  bounds: BinBounds,
  snap: SnapFn,
  setters: PathDrawingSetters
): void {
  const clamp = (v: number, max: number) => Math.max(0, Math.min(v, max));
  let x = snap(clamp(mmX, bounds.binWidth));
  let y = snap(clamp(mmY, bounds.binDepth));

  if (mode === null || mode.points.length === 0) {
    setters.setMode({
      type: 'path-drawing',
      points: [cornerPoint(x, y)],
      activePointDrag: true,
      repositionIndex: null,
    });
    return;
  }

  const { points } = mode;
  const lastPt = points[points.length - 1];

  if (shiftKey) {
    const snapped = snapAngle45(lastPt.x, lastPt.y, x, y);
    x = snap(clamp(snapped.x, bounds.binWidth));
    y = snap(clamp(snapped.y, bounds.binDepth));
  }

  if (
    points.length >= MIN_PATH_POINTS &&
    isNearPoint(x, y, points[0].x, points[0].y, CLOSE_SNAP_THRESHOLD)
  ) {
    setters.commitPath(points);
    setters.setPathDrawingPreview(null);
    return;
  }

  if (points.length >= MAX_PATH_POINTS) {
    return;
  }

  setters.setMode({
    type: 'path-drawing',
    points: [...points, cornerPoint(x, y)],
    activePointDrag: true,
    repositionIndex: null,
  });
}

// ── Pointer move ─────────────────────────────────────────────────────────────

/** Minimum drag distance (mm) before creating bezier handles. */
const HANDLE_DRAG_THRESHOLD = 1;

/**
 * Handle pointer move during path drawing.
 *
 * When `activePointDrag` is true (pointer held down after placing a point),
 * the cursor position defines the outgoing bezier handle on the last point.
 * A symmetric incoming handle is created automatically.
 *
 * When `activePointDrag` is false (hovering between clicks), updates the
 * preview cursor position and close-snap indicator.
 *
 * Shift key constrains handle direction to 45-degree increments.
 *
 * @param mode - Current path-drawing mode state.
 * @param event - Pointer position and modifier keys.
 * @param bounds - Bin boundary dimensions for clamping.
 * @param snap - Snap function respecting the current snap-enabled state.
 * @param setters - Callbacks to push state changes.
 */
export function handlePathDrawingPointerMove(
  mode: PathDrawingMode,
  event: PointerMoveEvent,
  bounds: BinBounds,
  _snap: SnapFn,
  setters: PathDrawingSetters
): void {
  const { points, activePointDrag, repositionIndex } = mode;
  if (points.length === 0) return;

  const clamp = (v: number, max: number) => Math.max(0, Math.min(v, max));
  const cursorX = clamp(event.mmX, bounds.binWidth);
  const cursorY = clamp(event.mmY, bounds.binDepth);

  // Repositioning an existing vertex
  if (repositionIndex !== null) {
    let x = cursorX;
    let y = cursorY;
    if (event.shiftKey && repositionIndex > 0) {
      const prev = points[repositionIndex - 1];
      const snapped = snapAngle45(prev.x, prev.y, x, y);
      x = clamp(snapped.x, bounds.binWidth);
      y = clamp(snapped.y, bounds.binDepth);
    }

    const nextPoints = points.map((pt, i) => (i === repositionIndex ? { ...pt, x, y } : pt));

    setters.setMode({
      type: 'path-drawing',
      points: nextPoints,
      activePointDrag: false,
      repositionIndex,
    });
    setters.setPathDrawingPreview({
      points: nextPoints,
      cursorX,
      cursorY,
      canClose: false,
    });
    return;
  }

  if (activePointDrag) {
    const lastPt = points[points.length - 1];
    const dx = cursorX - lastPt.x;
    const dy = cursorY - lastPt.y;
    const dragDist = Math.sqrt(dx * dx + dy * dy);

    if (dragDist < HANDLE_DRAG_THRESHOLD) {
      setters.setPathDrawingPreview({ points, cursorX, cursorY, canClose: false });
      return;
    }

    let handleX = cursorX;
    let handleY = cursorY;
    if (event.shiftKey) {
      const snapped = snapAngle45(lastPt.x, lastPt.y, cursorX, cursorY);
      handleX = snapped.x;
      handleY = snapped.y;
    }

    const handleOutDx = handleX - lastPt.x;
    const handleOutDy = handleY - lastPt.y;

    const updatedPoint: PathPoint = {
      ...lastPt,
      handleOut: { dx: handleOutDx, dy: handleOutDy },
      handleIn: { dx: -handleOutDx, dy: -handleOutDy },
      symmetric: true,
    };

    const nextPoints = [...points.slice(0, -1), updatedPoint];

    setters.setMode({
      type: 'path-drawing',
      points: nextPoints,
      activePointDrag: true,
      repositionIndex: null,
    });
    setters.setPathDrawingPreview({
      points: nextPoints,
      cursorX: handleX,
      cursorY: handleY,
      canClose: false,
    });
  } else {
    const canClose =
      points.length >= MIN_PATH_POINTS &&
      isNearPoint(cursorX, cursorY, points[0].x, points[0].y, CLOSE_SNAP_THRESHOLD);

    setters.setPathDrawingPreview({ points, cursorX, cursorY, canClose });
  }
}

// ── Pointer up ───────────────────────────────────────────────────────────────

/**
 * Handle pointer up during path drawing.
 *
 * Completes the current point placement by setting `activePointDrag`
 * to false. Any bezier handles created during the drag are finalized.
 *
 * @param mode - Current path-drawing mode state.
 * @param setters - Callbacks to push state changes.
 */
export function handlePathDrawingPointerUp(
  mode: PathDrawingMode,
  setters: Pick<PathDrawingSetters, 'setMode'>
): void {
  if (!mode.activePointDrag && mode.repositionIndex === null) return;

  setters.setMode({
    type: 'path-drawing',
    points: mode.points,
    activePointDrag: false,
    repositionIndex: null,
  });
}

// ── Vertex reposition ─────────────────────────────────────────────────────

/**
 * Start repositioning an existing vertex during path drawing.
 *
 * Called when the user clicks on a vertex dot in the drawing preview.
 * If the click is on the first vertex with MIN_PATH_POINTS+ points, closes the path instead.
 */
export function handlePathDrawingVertexDown(
  mode: PathDrawingMode,
  vertexIndex: number,
  setters: PathDrawingSetters
): void {
  const { points } = mode;

  // Clicking the first vertex with enough points closes the path
  if (vertexIndex === 0 && points.length >= MIN_PATH_POINTS) {
    setters.commitPath(points);
    setters.setPathDrawingPreview(null);
    return;
  }

  // Start repositioning this vertex
  setters.setMode({
    type: 'path-drawing',
    points,
    activePointDrag: false,
    repositionIndex: vertexIndex,
  });
}
