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
import type { PointerMoveEvent, BinBounds, SnapFn, PreviewSetters, SetModeFn } from './types';

// ── Types ────────────────────────────────────────────────────────────────────

/** Target being dragged during vertex editing. */
export type VertexDragTarget =
  | { readonly type: 'vertex'; readonly index: number }
  | { readonly type: 'handle'; readonly index: number; readonly handleType: 'in' | 'out' };

/** Mode state for vertex editing, entered by double-clicking a path cutout. */
export interface VertexEditMode {
  readonly type: 'vertex-editing';
  readonly cutoutId: string;
  readonly selectedPointIndex: number | null;
  readonly dragTarget: VertexDragTarget | null;
}

/** Info about the segment the cursor is hovering near (for add-point preview). */
export interface SegmentHoverInfo {
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
  const path = cutout.path;
  if (!path || path.length === 0) return;

  // Clear hover on any pointer down
  setters.setSegmentHover(null);

  for (let i = 0; i < path.length; i++) {
    if (isNearPoint(event.mmX, event.mmY, path[i].x, path[i].y, threshold)) {
      setters.setMode({
        ...mode,
        selectedPointIndex: i,
        dragTarget: { type: 'vertex', index: i },
      });
      return;
    }
  }

  if (mode.selectedPointIndex !== null) {
    const pt = path[mode.selectedPointIndex];

    if (pt.handleIn) {
      const hx = pt.x + pt.handleIn.dx;
      const hy = pt.y + pt.handleIn.dy;
      if (isNearPoint(event.mmX, event.mmY, hx, hy, threshold)) {
        setters.setMode({
          ...mode,
          dragTarget: { type: 'handle', index: mode.selectedPointIndex, handleType: 'in' },
        });
        return;
      }
    }

    if (pt.handleOut) {
      const hx = pt.x + pt.handleOut.dx;
      const hy = pt.y + pt.handleOut.dy;
      if (isNearPoint(event.mmX, event.mmY, hx, hy, threshold)) {
        setters.setMode({
          ...mode,
          dragTarget: { type: 'handle', index: mode.selectedPointIndex, handleType: 'out' },
        });
        return;
      }
    }
  }

  const seg = findNearestSegment(event.mmX, event.mmY, path, threshold);
  if (seg) {
    const { before, mid, after } = splitBezierSegment(
      path[seg.segmentIndex],
      path[(seg.segmentIndex + 1) % path.length],
      seg.t
    );

    const updatedPath: PathPoint[] = [...path];
    updatedPath[seg.segmentIndex] = before;
    updatedPath[(seg.segmentIndex + 1) % path.length] = after;

    const insertIdx = seg.segmentIndex + 1;
    updatedPath.splice(insertIdx, 0, mid);

    setters.onUpdate(cutout.id, pathBoundsUpdate(updatedPath));
    setters.setMode({ ...mode, selectedPointIndex: insertIdx, dragTarget: null });
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
  const path = cutout.path;
  if (!path || path.length === 0) return;

  // When not dragging, compute segment hover for add-point preview
  if (!mode.dragTarget) {
    const seg = findNearestSegment(event.mmX, event.mmY, path, SEGMENT_HOVER_THRESHOLD);
    if (seg) {
      const pt = evaluateSegmentPoint(path, seg.segmentIndex, seg.t);
      setters.setSegmentHover({ segmentIndex: seg.segmentIndex, t: seg.t, x: pt.x, y: pt.y });
    } else {
      setters.setSegmentHover(null);
    }
    return;
  }

  const { dragTarget } = mode;

  if (dragTarget.type === 'vertex') {
    // Snap and clamp the vertex position
    const x = Math.max(0, Math.min(snap(event.mmX), bounds.binWidth));
    const y = Math.max(0, Math.min(snap(event.mmY), bounds.binDepth));

    const updatedPath = updatePoint(path, dragTarget.index, { x, y });

    setters.setPreview(new Map([[cutout.id, { path: updatedPath }]]));
  } else {
    const pt = path[dragTarget.index];
    // Clamp handle endpoint to bin bounds
    const clampedX = Math.max(0, Math.min(event.mmX, bounds.binWidth));
    const clampedY = Math.max(0, Math.min(event.mmY, bounds.binDepth));
    const dx = clampedX - pt.x;
    const dy = clampedY - pt.y;

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

    setters.setPreview(new Map([[cutout.id, { path: updatedPath }]]));
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
  if (previewUpdates?.path) {
    // Reject edits that create self-intersecting paths
    if (!isSelfIntersecting(previewUpdates.path)) {
      setters.onUpdate(cutout.id, pathBoundsUpdate(previewUpdates.path));
    }
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
 * - Delete/Backspace: remove the selected vertex (if 3+ points remain)
 * - Escape: exit vertex editing mode
 */
export function handleVertexEditKeyDown(
  event: KeyboardEvent,
  mode: VertexEditMode,
  cutout: Cutout,
  setters: VertexEditSetters
): void {
  const path = cutout.path;
  if (!path) return;

  switch (event.key) {
    case 'Delete':
    case 'Backspace': {
      if (mode.selectedPointIndex === null) return;

      const updated = removePoint(path, mode.selectedPointIndex);
      if (!updated) return; // fewer than 3 points would remain

      event.preventDefault();
      setters.onUpdate(cutout.id, pathBoundsUpdate(updated));

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

    case 'Escape':
      event.preventDefault();
      setters.setMode({ type: 'idle' });
      break;
  }
}
