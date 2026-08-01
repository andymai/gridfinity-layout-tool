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
import {
  clampToDrawer,
  moveVertex,
  rectangleSketch,
  removeVertex,
  snapMm,
} from '../../utils/penShape';
import type { SnapFraction } from '../../utils/penShape';

/** Undo depth. Deep enough for a long editing session, bounded so a drag can't grow it without limit. */
const MAX_HISTORY = 50;

export interface PenSketch {
  readonly verts: readonly OutlineVertex[];
  readonly selected: number | null;
  readonly canUndo: boolean;
  setSelected: (index: number | null) => void;
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
  reset: (widthMm: number, depthMm: number) => void;
  /** Move the selected corner by a snapped step, for arrow-key nudging. */
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
  const [selected, setSelected] = useState<number | null>(null);
  const [history, setHistory] = useState<readonly (readonly OutlineVertex[])[]>([]);
  // Set at pointer-down so the whole drag collapses into one undo entry.
  const gestureRef = useRef(false);

  const active = useMemo(() => verts ?? seeded ?? [], [verts, seeded]);

  const push = useCallback((prev: readonly OutlineVertex[]) => {
    setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), prev]);
  }, []);

  const commit = useCallback(
    (next: readonly OutlineVertex[]) => {
      push(active);
      setVerts(next);
    },
    [active, push]
  );

  const preview = useCallback((next: readonly OutlineVertex[]) => {
    setVerts(next);
  }, []);

  const beginGesture = useCallback(() => {
    if (gestureRef.current) return;
    gestureRef.current = true;
    push(active);
    // Cleared on the next tick so a second pointer-down opens a new entry.
    queueMicrotask(() => {
      gestureRef.current = false;
    });
  }, [active, push]);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const restored = h[h.length - 1];
      setVerts(restored);
      // Keep the selection across an undo when the corner still exists, so the
      // coordinate fields do not blink out from under an edit. Undoing an
      // insert or delete can shorten the list, hence the bound check.
      setSelected((sel) => (sel !== null && sel < restored.length ? sel : null));
      return h.slice(0, -1);
    });
  }, []);

  const reset = useCallback(
    (widthMm: number, depthMm: number) => {
      push(active);
      setVerts(rectangleSketch(widthMm, depthMm));
      setSelected(null);
    },
    [active, push]
  );

  const nudge = useCallback(
    (dx: number, dy: number, bounds: NudgeBounds) => {
      // A stale selection can outlive the vertex it pointed at (a delete, or a
      // reseed), so bound-check rather than trusting the index.
      if (selected === null || selected >= active.length) return;
      const v = active[selected];
      // Step by the active snap increment so keyboard and pointer editing land
      // on the same coordinates; 1mm when snapping is off.
      const stepX = bounds.snap === 0 ? 1 : bounds.pitchX * bounds.snap;
      const stepY = bounds.snap === 0 ? 1 : bounds.pitchY * bounds.snap;
      const p = clampToDrawer(v.x + dx * stepX, v.y + dy * stepY, bounds.widthMm, bounds.depthMm);
      commit(
        moveVertex(
          active,
          selected,
          snapMm(p.x, bounds.pitchX, bounds.snap),
          snapMm(p.y, bounds.pitchY, bounds.snap)
        )
      );
    },
    [selected, active, commit]
  );

  const deleteSelected = useCallback(() => {
    if (selected === null || active.length <= 3) return;
    commit(removeVertex(active, selected));
    setSelected(null);
  }, [selected, active, commit]);

  return {
    verts: active,
    selected,
    canUndo: history.length > 0,
    setSelected,
    commit,
    preview,
    beginGesture,
    undo,
    reset,
    nudge,
    deleteSelected,
  };
}
