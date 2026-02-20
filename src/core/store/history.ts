import { create } from 'zustand';
import { useCallback, useRef, useEffect } from 'react';
import type { Layout } from '@/core/types';
import { useLayoutStore } from './layout';
import { useSelectionStore } from './selection';
import { CONSTRAINTS } from '@/core/constants';
import { mlTracking } from '@/shared/analytics/useMLTracking';

function cloneLayout(layout: Layout): Layout {
  if (typeof structuredClone === 'function') {
    return structuredClone(layout);
  }
  try {
    return JSON.parse(JSON.stringify(layout)) as Layout;
  } catch {
    // JSON round-trip on a plain Layout object should never fail,
    // but return a shallow copy as a last resort
    return { ...layout };
  }
}

function pruneStaleSelections(restoredLayout: Layout): void {
  const binIds = new Set(restoredLayout.bins.map((b) => b.id));
  const layerIds = new Set(restoredLayout.layers.map((l) => l.id));
  const categoryIds = new Set(restoredLayout.categories.map((c) => c.id));
  const selectionState = useSelectionStore.getState();

  const prunedIds = selectionState.selectedBinIds.filter((id) => binIds.has(id));
  if (prunedIds.length !== selectionState.selectedBinIds.length) {
    useSelectionStore.setState({ selectedBinIds: prunedIds });
  }

  if (selectionState.focusedBinId && !binIds.has(selectionState.focusedBinId)) {
    useSelectionStore.setState({ focusedBinId: null });
  }

  if (selectionState.quickLabelBinId && !binIds.has(selectionState.quickLabelBinId)) {
    useSelectionStore.setState({ quickLabelBinId: null });
  }

  // Reset active layer if it no longer exists in the restored layout
  if (!layerIds.has(selectionState.activeLayerId) && restoredLayout.layers.length > 0) {
    useSelectionStore.setState({ activeLayerId: restoredLayout.layers[0].id });
  }

  // Reset active category if it no longer exists in the restored layout
  if (!categoryIds.has(selectionState.activeCategoryId) && restoredLayout.categories.length > 0) {
    useSelectionStore.setState({ activeCategoryId: restoredLayout.categories[0].id });
  }
}

export interface HistoryEntry {
  layout: Layout;
  description: string;
}

interface HistoryState {
  past: HistoryEntry[];
  future: HistoryEntry[];

  canUndo: boolean;
  canRedo: boolean;
  undoDescription: string | null;
  redoDescription: string | null;

  push: (layout: Layout, description?: string) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,
  undoDescription: null,
  redoDescription: null,

  push: (layout, description) => {
    set((state) => {
      const entry: HistoryEntry = { layout, description: description ?? '' };
      const newPast = [...state.past, entry];
      if (newPast.length > CONSTRAINTS.UNDO_LIMIT) {
        newPast.shift();
      }
      return {
        past: newPast,
        future: [],
        canUndo: true,
        canRedo: false,
        undoDescription: description ?? null,
        redoDescription: null,
      };
    });
  },

  undo: () => {
    const { past } = get();
    if (past.length === 0) return;

    const current = useLayoutStore.getState().layout;
    const previousEntry = past[past.length - 1];

    set((state) => {
      const newPast = state.past.slice(0, -1);
      const currentEntry: HistoryEntry = {
        layout: current,
        description: previousEntry.description,
      };
      return {
        past: newPast,
        future: [currentEntry, ...state.future],
        canUndo: newPast.length > 0,
        canRedo: true,
        undoDescription:
          newPast.length > 0 ? newPast[newPast.length - 1].description || null : null,
        redoDescription: previousEntry.description || null,
      };
    });

    useLayoutStore.setState({ layout: previousEntry.layout });
    pruneStaleSelections(previousEntry.layout);

    // Track undo for ML telemetry
    mlTracking.trackUndoOp(previousEntry.layout, current);
  },

  redo: () => {
    const { future } = get();
    if (future.length === 0) return;

    const current = useLayoutStore.getState().layout;
    const nextEntry = future[0];

    set((state) => {
      const newFuture = state.future.slice(1);
      const currentEntry: HistoryEntry = {
        layout: current,
        description: nextEntry.description,
      };
      return {
        past: [...state.past, currentEntry],
        future: newFuture,
        canUndo: true,
        canRedo: newFuture.length > 0,
        undoDescription: nextEntry.description || null,
        redoDescription: newFuture.length > 0 ? newFuture[0].description || null : null,
      };
    });

    useLayoutStore.setState({ layout: nextEntry.layout });
    pruneStaleSelections(nextEntry.layout);
  },

  clear: () => {
    set({
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
      undoDescription: null,
      redoDescription: null,
    });
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
 * const result = execute(() => addBin({ ... }), 'Draw bin');
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
    <T>(action: () => T, description?: string): T => {
      push(cloneLayout(layoutRef.current), description);
      const result = action();
      // Record timestamp AFTER action executes for accurate undo timing
      mlTracking.recordAction();
      return result;
    },
    [push]
  );

  return { execute };
}
