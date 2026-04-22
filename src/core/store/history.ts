import { create } from 'zustand';
import type { Layout, BinId, LayerId, CategoryId } from '@/core/types';
import type { CommandType } from '@/core/cqrs/commands';
import { useLayoutStore } from './layout';
import { useSelectionStore } from './selection';
import { useToastStore } from './toast';
import { CONSTRAINTS } from '@/core/constants';
import { mlTracking } from '@/shared/analytics/useMLTracking';
import { getCommandDescriptionKey } from '@/core/cqrs/commandDescriptions';
import { getStaticTranslation } from '@/i18n';

/**
 * Subset of the selection store captured alongside the layout snapshot.
 * Reverting these on undo restores the user's active layer/category/focus
 * rather than silently resetting them to `layers[0]` via pruning.
 */
export interface SelectionSnapshot {
  readonly activeLayerId: LayerId;
  readonly activeCategoryId: CategoryId;
  readonly selectedBinIds: ReadonlyArray<BinId>;
  readonly focusedBinId: BinId | null;
  readonly quickLabelBinId: BinId | null;
}

export function captureSelectionSnapshot(): SelectionSnapshot {
  const s = useSelectionStore.getState();
  return {
    activeLayerId: s.activeLayerId,
    activeCategoryId: s.activeCategoryId,
    selectedBinIds: [...s.selectedBinIds],
    focusedBinId: s.focusedBinId,
    quickLabelBinId: s.quickLabelBinId,
  };
}

/**
 * Restore selection from a snapshot, reconciling against the restored layout.
 * A snapshotted ID that no longer exists in the restored layout falls back to
 * the same pruning logic used before snapshots were captured.
 */
/**
 * Fallback active-layer id when the snapshotted/current id is no longer in
 * the restored layout. Matches `handleRestoreLayout` in restoreHandlers.ts:
 * use the last layer in data order (= top layer in the UI, since the UI
 * reverses via `getDisplayLayers()`). New bins typically land on the top
 * layer, so this is the least-surprising fallback.
 */
function fallbackActiveLayerId(restoredLayout: Layout): LayerId {
  return restoredLayout.layers[restoredLayout.layers.length - 1].id;
}

function restoreSelectionFromSnapshot(restoredLayout: Layout, snapshot: SelectionSnapshot): void {
  const binIds = new Set(restoredLayout.bins.map((b) => b.id));
  const layerIds = new Set(restoredLayout.layers.map((l) => l.id));
  const categoryIds = new Set(restoredLayout.categories.map((c) => c.id));

  const activeLayerId =
    layerIds.has(snapshot.activeLayerId) || restoredLayout.layers.length === 0
      ? snapshot.activeLayerId
      : fallbackActiveLayerId(restoredLayout);

  const activeCategoryId =
    categoryIds.has(snapshot.activeCategoryId) || restoredLayout.categories.length === 0
      ? snapshot.activeCategoryId
      : restoredLayout.categories[0].id;

  useSelectionStore.getState().restoreSelection({
    activeLayerId,
    activeCategoryId,
    selectedBinIds: snapshot.selectedBinIds.filter((id) => binIds.has(id)),
    focusedBinId:
      snapshot.focusedBinId && binIds.has(snapshot.focusedBinId) ? snapshot.focusedBinId : null,
    quickLabelBinId:
      snapshot.quickLabelBinId && binIds.has(snapshot.quickLabelBinId)
        ? snapshot.quickLabelBinId
        : null,
  });
}

/**
 * Legacy pruning — used when a history entry has no captured selection
 * (pre-fix entries, or direct push() calls from outside the middleware).
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

  if (!layerIds.has(selectionState.activeLayerId) && restoredLayout.layers.length > 0) {
    updates.activeLayerId = fallbackActiveLayerId(restoredLayout);
  }

  if (!categoryIds.has(selectionState.activeCategoryId) && restoredLayout.categories.length > 0) {
    updates.activeCategoryId = restoredLayout.categories[0].id;
  }

  if (Object.keys(updates).length > 0) {
    useSelectionStore.getState().restoreSelection(updates);
  }
}

export interface HistoryEntry {
  layout: Layout;
  commandType: CommandType | 'unknown';
  /** Selection captured at the same moment as `layout`. */
  selection?: SelectionSnapshot;
}

interface HistoryState {
  past: HistoryEntry[];
  future: HistoryEntry[];

  canUndo: boolean;
  canRedo: boolean;

  push: (
    layout: Layout,
    commandType?: CommandType | 'unknown',
    selection?: SelectionSnapshot
  ) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

function applySelection(restoredLayout: Layout, snapshot: SelectionSnapshot | undefined): void {
  if (snapshot) {
    restoreSelectionFromSnapshot(restoredLayout, snapshot);
  } else {
    pruneStaleSelections(restoredLayout);
  }
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

  push: (layout, commandType = 'unknown', selection) => {
    set((state) => {
      const entry: HistoryEntry = { layout, commandType, selection };
      const newPast = [...state.past, entry];
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
    const currentSelection = captureSelectionSnapshot();
    const previousEntry = past[past.length - 1];
    const { layout: previous, commandType, selection: previousSelection } = previousEntry;

    set((state) => ({
      past: state.past.slice(0, -1),
      future: [{ layout: current, commandType, selection: currentSelection }, ...state.future],
      canUndo: state.past.length > 1,
      canRedo: true,
    }));

    useLayoutStore.getState().restoreLayout(previous);
    applySelection(previous, previousSelection);

    // Show undo toast with action description
    // NOTE: getStaticTranslation uses English only. Full locale support
    // requires a locale-aware static helper or toast i18n key support.
    const descKey = getCommandDescriptionKey(commandType);
    const action = getStaticTranslation(descKey);
    useToastStore.getState().addToast({
      message: getStaticTranslation('undo.undid', { action }),
      type: 'info',
      duration: 2000,
    });

    // Track undo for ML telemetry
    // previousLayout = state we're reverting TO, currentLayout = state we had BEFORE undo
    mlTracking.trackUndoOp(previous, current);
  },

  redo: () => {
    const { future } = get();
    if (future.length === 0) return;

    const current = useLayoutStore.getState().layout;
    const currentSelection = captureSelectionSnapshot();
    const nextEntry = future[0];
    const { layout: next, commandType, selection: nextSelection } = nextEntry;

    set((state) => ({
      past: [...state.past, { layout: current, commandType, selection: currentSelection }],
      future: state.future.slice(1),
      canUndo: true,
      canRedo: state.future.length > 1,
    }));

    useLayoutStore.getState().restoreLayout(next);
    applySelection(next, nextSelection);

    // Show redo toast with action description
    const descKey = getCommandDescriptionKey(commandType);
    const action = getStaticTranslation(descKey);
    useToastStore.getState().addToast({
      message: getStaticTranslation('undo.redid', { action }),
      type: 'info',
      duration: 2000,
    });
  },

  clear: () => {
    set({ past: [], future: [], canUndo: false, canRedo: false });
  },
}));
