/**
 * Keys and buttons that edit the selected points of a path: delete, nudge,
 * make smooth or sharp, and size the pull radius for grabbing an edge.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { removePoint } from '../pathGeometry';
import { keepsShape, ringUpdate, ringsOf, toPathFrame } from './pathRings';
import {
  allSmooth,
  movePoints,
  normalizeSelection,
  removePoints,
  setPointKind,
  type PointKind,
} from './pointEdits';
import { DEFAULT_FALLOFF_MM, nextFalloff } from './falloffDrag';
import { saveFalloffMm } from './falloffRadiusStorage';
import { countPointEdit } from './pointEditStats';
import {
  selectedIndices,
  withSelection,
  type VertexEditMode,
  type VertexEditSetters,
} from './vertexEditMode';

/** Matches the shape nudge in `keyboardHandler`, so a point moves as far as a shape. */
const NUDGE_MM = 0.5;
const SHIFT_NUDGE_MM = 5;

const ARROWS: Readonly<Partial<Record<string, readonly [number, number]>>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
};

function checked(
  cutout: Cutout,
  ring: number,
  points: Parameters<typeof ringUpdate>[2]
): Partial<Cutout> | null {
  const update = ringUpdate(cutout, ring, points);
  return keepsShape(ringsOf(cutout), ringsOf({ ...cutout, ...update }), ring) ? update : null;
}

/**
 * The selected points made smooth or sharp. With no kind given, sharp points
 * become smooth unless every one already is, as a toggle does. Null when
 * nothing is selected or the result would not cut as drawn.
 */
export function pointKindUpdate(
  mode: VertexEditMode,
  cutout: Cutout,
  kind?: PointKind
): Partial<Cutout> | null {
  const path = ringsOf(cutout).at(mode.ring);
  if (!path) return null;
  const indices = normalizeSelection(selectedIndices(mode), path.length);
  if (indices.length === 0) return null;
  const chosen = kind ?? (allSmooth(path, indices) ? 'corner' : 'smooth');
  return checked(cutout, mode.ring, setPointKind(path, indices, chosen));
}

function deleteSelected(
  event: KeyboardEvent,
  mode: VertexEditMode,
  cutout: Cutout,
  setters: VertexEditSetters
): void {
  const path = ringsOf(cutout).at(mode.ring);
  // A drag in progress would write its preview over the deletion on release.
  if (!path || mode.dragTarget) return;
  // An index past the end splices nothing, so the "updated" path came back
  // identical and was committed anyway — an undo entry that undoes to
  // itself. The path shrinks outside this handler, so the index can lead.
  const indices = normalizeSelection(selectedIndices(mode), path.length);
  if (indices.length === 0) return;

  const single = indices.length === 1;
  const updated = single ? removePoint(path, indices[0]) : removePoints(path, indices);
  if (!updated) return;
  const update = checked(cutout, mode.ring, updated);
  if (!update) return;

  event.preventDefault();
  setters.onUpdate(cutout.id, update);
  countPointEdit('delete');
  // One point gone hands the selection to its neighbour, so Delete can be
  // pressed again; several leave nothing selected.
  const next = single ? [Math.min(indices[0], updated.length - 1)] : [];
  setters.setMode({ ...withSelection(mode, mode.ring, next), dragTarget: null });
}

function nudgeSelected(
  event: KeyboardEvent,
  mode: VertexEditMode,
  cutout: Cutout,
  setters: VertexEditSetters
): void {
  const path = ringsOf(cutout).at(mode.ring);
  const step = ARROWS[event.key];
  if (!path || !step || mode.dragTarget) return;
  const indices = normalizeSelection(selectedIndices(mode), path.length);
  if (indices.length === 0) return;
  event.preventDefault();
  const mm = event.shiftKey ? SHIFT_NUDGE_MM : NUDGE_MM;
  // The arrows move the points as drawn; a turned path stores them turned back.
  const origin = toPathFrame(cutout, 0, 0);
  const moved = toPathFrame(cutout, step[0] * mm, step[1] * mm);
  const update = checked(
    cutout,
    mode.ring,
    movePoints(path, indices, moved.x - origin.x, moved.y - origin.y)
  );
  if (!update) return;
  setters.onUpdate(cutout.id, update);
  countPointEdit('nudge');
}

/**
 * Handle keydown events during vertex editing.
 *
 * - Delete/Backspace: remove the selected points (down to MIN_PATH_POINTS anchors)
 * - Arrow keys: nudge the selected points, Shift for a larger step
 * - `[` and `]`: shrink or grow the pull radius for grabbing an edge
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
  switch (event.key) {
    case 'Delete':
    case 'Backspace':
      deleteSelected(event, mode, cutout, setters);
      return;
    case '[':
    case ']': {
      // A pull keeps the reach it began with, so the ring keeps showing it.
      if (mode.dragTarget) return;
      event.preventDefault();
      const falloffMm = nextFalloff(mode.falloffMm ?? DEFAULT_FALLOFF_MM, event.key === ']');
      saveFalloffMm(falloffMm);
      setters.setMode({ ...mode, falloffMm });
      return;
    }
    default:
      nudgeSelected(event, mode, cutout, setters);
  }
}
