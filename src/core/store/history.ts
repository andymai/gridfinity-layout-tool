import { create } from 'zustand';
import type { Layout, BinId, LayerId, CategoryId } from '@/core/types';
import { useLayoutStore } from './layout';
import { useSelectionStore } from './selection';
import { CONSTRAINTS } from '@/core/constants';
import { mlTracking } from '@/shared/analytics/useMLTracking';

/**
 * Remove stale bin references from the selection store after layout restoration.
 * Called after undo/redo to prevent selectedBinIds, focusedBinId, etc. from
 * referencing bins that no longer exist in the restored layout.
 *
 * Uses the selection store's restoreSelection() action instead of raw setState()
 * to maintain store encapsulation.
 */
function pruneStaleSelections(restoredLayout: Layout): void {
  const binIds = new Set(restoredLayout.bins.map((b) => b.id));
  const layerIds = new Set(restoredLayout.layers.map((l) => l.id));
  const categoryIds = new Set(restoredLayout.categories.map((c) => c.id));
  const selectionState = useSelectionStore.getState();

  const updates: {
    selectedBinIds?: BinId[];
    focusedBinId?: BinId | null;
    quickLabelBinId?: BinId | null;
    activeLayerId?: LayerId;
    activeCategoryId?: CategoryId;
  } = {};

  const prunedIds = selectionState.selectedBinIds.filter((id) => binIds.has(id));
  if (prunedIds.length !== selectionState.selectedBinIds.length) {
    updates.selectedBinIds = prunedIds;
  }

  if (selectionState.focusedBinId && !binIds.has(selectionState.focusedBinId)) {
    updates.focusedBinId = null;
  }

  if (selectionState.quickLabelBinId && !binIds.has(selectionState.quickLabelBinId)) {
    updates.quickLabelBinId = null;
  }

  // Reset active layer if it no longer exists in the restored layout
  if (!layerIds.has(selectionState.activeLayerId) && restoredLayout.layers.length > 0) {
    updates.activeLayerId = restoredLayout.layers[0].id;
  }

  // Reset active category if it no longer exists in the restored layout
  if (!categoryIds.has(selectionState.activeCategoryId) && restoredLayout.categories.length > 0) {
    updates.activeCategoryId = restoredLayout.categories[0].id;
  }

  if (Object.keys(updates).length > 0) {
    useSelectionStore.getState().restoreSelection(updates);
  }
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

/**
 * History store — undo/redo stack (max 100 states).
 * Undo snapshots are captured automatically by the CQRS undo middleware.
 * Use `batch()` from `@/core/cqrs` to group multiple mutations into one undo step.
 */
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

    useLayoutStore.getState().restoreLayout(previous);
    pruneStaleSelections(previous);

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

    useLayoutStore.getState().restoreLayout(next);
    pruneStaleSelections(next);
  },

  clear: () => {
    set({ past: [], future: [], canUndo: false, canRedo: false });
  },
}));
