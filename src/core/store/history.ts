import { create } from 'zustand';
import { useCallback, useRef, useEffect } from 'react';
import type { Layout } from '@/core/types';
import { useLayoutStore } from './layout';
import { CONSTRAINTS } from '@/core/constants';
import { mlTracking } from '@/shared/analytics/useMLTracking';

/**
 * Deep clone a layout object.
 * Uses structuredClone for performance when available (modern browsers),
 * falls back to JSON serialization for older environments.
 */
function cloneLayout(layout: Layout): Layout {
  if (typeof structuredClone === 'function') {
    return structuredClone(layout);
  }
  return JSON.parse(JSON.stringify(layout));
}

interface HistoryState {
  past: Layout[];
  future: Layout[];

  canUndo: boolean;
  canRedo: boolean;

  push: (layout: Layout) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,

  push: (layout) => {
    set((state) => {
      const newPast = [...state.past, layout];
      if (newPast.length > CONSTRAINTS.UNDO_LIMIT) {
        newPast.shift();
      }
      return {
        past: newPast,
        future: [], // Clear future on new action
        canUndo: true,
        canRedo: false,
      };
    });
  },

  undo: () => {
    const { past } = get();
    if (past.length === 0) return;

    const current = useLayoutStore.getState().layout;
    const previous = past[past.length - 1];

    set((state) => ({
      past: state.past.slice(0, -1),
      future: [current, ...state.future],
      canUndo: state.past.length > 1,
      canRedo: true,
    }));

    useLayoutStore.setState({ layout: previous });

    // Track undo for ML telemetry
    // previousLayout = state we're reverting TO, currentLayout = state we had BEFORE undo
    mlTracking.trackUndoOp(previous, current);
  },

  redo: () => {
    const { future } = get();
    if (future.length === 0) return;

    const current = useLayoutStore.getState().layout;
    const next = future[0];

    set((state) => ({
      past: [...state.past, current],
      future: state.future.slice(1),
      canUndo: true,
      canRedo: state.future.length > 1,
    }));

    useLayoutStore.setState({ layout: next });
  },

  clear: () => {
    set({ past: [], future: [], canUndo: false, canRedo: false });
  },
}));

/**
 * Hook to wrap layout actions with history tracking.
 * Use this instead of calling layout store directly for undoable actions.
 *
 * The execute function returns whatever the action returns, allowing callers
 * to check Result types from store actions:
 *
 * @example
 * ```ts
 * const result = execute(() => addBin({ ... }));
 * if (isOk(result)) {
 *   // handle success
 * } else {
 *   addToast(getUserMessage(result.error), 'error');
 * }
 * ```
 */
export function useUndoableAction() {
  const layout = useLayoutStore((state) => state.layout);
  const push = useHistoryStore((state) => state.push);

  // Use ref to track current layout without causing callback to change
  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  const execute = useCallback(
    <T>(action: () => T): T => {
      push(cloneLayout(layoutRef.current));
      const result = action();
      // Record timestamp AFTER action executes for accurate undo timing
      mlTracking.recordAction();
      return result;
    },
    [push]
  ); // Only depends on push, which is stable from Zustand

  return { execute };
}
