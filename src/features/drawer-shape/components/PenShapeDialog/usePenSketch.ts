/**
 * Sketch state for the pen editor: the vertex list, the selection, and a
 * bounded undo stack.
 *
 * Split from the component because the editor is judged against a real vector
 * tool, where undo and keyboard editing are not extras — a drag that overshoots
 * is otherwise only recoverable by cancelling and starting the shape again.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type { OutlineVertex } from '@/core/types';
import { clampToDrawer, moveVertices, rectangleSketch, removeVertices } from '../../utils/penShape';
import type { SnapFraction } from '../../utils/penShape';

/** Undo depth. Deep enough for a long editing session, bounded so a drag can't grow it without limit. */
const MAX_HISTORY = 50;

export interface PenSketch {
  readonly verts: readonly OutlineVertex[];
  /** Selected corner indices. Empty when nothing is selected. */
  readonly selected: ReadonlySet<number>;
  readonly canUndo: boolean;
  /** Replace the selection outright. */
  setSelected: (indices: Iterable<number>) => void;
  /** Add or remove one corner, for Shift-click. */
  toggleSelected: (index: number) => void;
  /** Replace the sketch and push the previous state onto the undo stack. */
  commit: (next: readonly OutlineVertex[]) => void;
  /**
   * Replace the sketch without a history entry. For the continuous part of a
   * drag: one pointer gesture should undo as one step, not fifty.
   */
  preview: (next: readonly OutlineVertex[]) => void;
  /** Open a history entry for a drag about to start. */
  beginGesture: () => void;
  undo: () => void;
  /** Disarm a gesture that ended without moving anything. */
  endGesture: () => void;
  reset: (widthMm: number, depthMm: number) => void;
  /** Move every selected corner by a snapped step, for arrow-key nudging. */
  nudge: (dx: number, dy: number, bounds: NudgeBounds) => void;
  deleteSelected: () => void;
}

export interface NudgeBounds {
  readonly widthMm: number;
  readonly depthMm: number;
  readonly pitchX: number;
  readonly pitchY: number;
  readonly snap: SnapFraction;
}

export function usePenSketch(seeded: readonly OutlineVertex[] | null): PenSketch {
  const [verts, setVerts] = useState<readonly OutlineVertex[] | null>(null);
  const [selected, setSelectedState] = useState<ReadonlySet<number>>(() => new Set());
  const setSelected = useCallback(
    (indices: Iterable<number>) => setSelectedState(new Set(indices)),
    []
  );
  const toggleSelected = useCallback((index: number) => {
    setSelectedState((prev) => {
      const next = new Set(prev);
      if (!next.delete(index)) next.add(index);
      return next;
    });
  }, []);
  const [history, setHistory] = useState<readonly (readonly OutlineVertex[])[]>([]);
  // Set at pointer-down so the whole drag collapses into one undo entry.
  const gestureRef = useRef(false);

  // The dialog stays mounted while closed, so nothing unmounts this state. A
  // new seed means a new session, and without dropping the old sketch reopening
  // would show the previous session's vertices rather than what is stored.
  const [seedIdentity, setSeedIdentity] = useState(seeded);
  if (seedIdentity !== seeded) {
    setSeedIdentity(seeded);
    setVerts(null);
    setHistory([]);
    setSelectedState(new Set());
  }

  const active = useMemo(() => verts ?? seeded ?? [], [verts, seeded]);

  const push = useCallback((prev: readonly OutlineVertex[]) => {
    setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), prev]);
  }, []);

  const commit = useCallback(
    (next: readonly OutlineVertex[]) => {
      // A commit is a completed edit, so it also disarms: a press that armed a
      // gesture and then committed without moving would otherwise leave the
      // flag set, and the next drag would spend a second entry on it.
      gestureRef.current = false;
      push(active);
      setVerts(next);
    },
    [active, push]
  );

  const preview = useCallback(
    (next: readonly OutlineVertex[]) => {
      if (gestureRef.current) {
        gestureRef.current = false;
        push(active);
      }
      setVerts(next);
    },
    [active, push]
  );

  /**
   * Arm a history entry for a drag about to start, without spending one yet.
   *
   * A press that only selects a corner, or a double-click that inserts one,
   * would otherwise push a state identical to the current one and cost an extra
   * undo press to get past. The entry is written on the first actual movement
   * instead, so one gesture is one undo step and a gesture that moved nothing
   * is none.
   */
  const beginGesture = useCallback(() => {
    gestureRef.current = true;
  }, []);

  // Reads `history` directly rather than from inside a `setHistory` updater: an
  // updater must be pure, and React may run it more than once under StrictMode
  // or concurrent rendering, which would apply the restore twice.
  const endGesture = useCallback(() => {
    gestureRef.current = false;
  }, []);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const restored = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setVerts(restored);
    // Keep the selection across an undo where the corners still exist, so the
    // coordinate fields do not blink out from under an edit. Undoing an insert
    // or delete can shorten the list, hence the bound filter.
    setSelectedState((sel) => new Set([...sel].filter((i) => i < restored.length)));
  }, [history]);

  const reset = useCallback(
    (widthMm: number, depthMm: number) => {
      push(active);
      setVerts(rectangleSketch(widthMm, depthMm));
      setSelectedState(new Set());
    },
    [active, push]
  );

  const nudge = useCallback(
    (dx: number, dy: number, bounds: NudgeBounds) => {
      if (selected.size === 0) return;
      // Step by the active snap increment so keyboard and pointer editing land
      // on the same coordinates; 1mm when snapping is off.
      const stepX = bounds.snap === 0 ? 1 : bounds.pitchX * bounds.snap;
      const stepY = bounds.snap === 0 ? 1 : bounds.pitchY * bounds.snap;
      // One shared delta, clamped so the whole selection stops together at the
      // wall rather than collapsing onto it corner by corner.
      let mx = dx * stepX;
      let my = dy * stepY;
      for (const i of selected) {
        // A stale index can outlive its vertex (a delete, or a reseed).
        if (i >= active.length) continue;
        const v = active[i];
        const c = clampToDrawer(v.x + mx, v.y + my, bounds.widthMm, bounds.depthMm);
        mx = c.x - v.x;
        my = c.y - v.y;
      }
      if (mx === 0 && my === 0) return;
      commit(moveVertices(active, selected, mx, my));
    },
    [selected, active, commit]
  );

  const deleteSelected = useCallback(() => {
    if (selected.size === 0 || active.length - selected.size < 3) return;
    commit(removeVertices(active, selected));
    setSelectedState(new Set());
  }, [selected, active, commit]);

  return {
    verts: active,
    selected,
    canUndo: history.length > 0,
    setSelected,
    toggleSelected,
    commit,
    preview,
    beginGesture,
    endGesture,
    undo,
    reset,
    nudge,
    deleteSelected,
  };
}
