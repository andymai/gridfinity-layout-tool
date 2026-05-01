import { create } from 'zustand';
import type { Layout, BinId, LayerId, CategoryId } from '@/core/types';
import type { CommandType } from '@/core/cqrs/commands';
import { createCommand } from '@/core/cqrs/commands';
import { commandBus } from '@/core/cqrs/bus/commandBus';
import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore } from '@/core/store/selection';
import { useToastStore } from '@/core/store/toast';
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

/**
 * History store — undo/redo stack (max 100 states).
 *
 * Snapshots are pushed by `undoCaptureMiddleware`. `undo()` / `redo()`
 * dispatch a `layout.restore` command via the command bus, which routes
 * through `handleRestoreLayout` to apply the layout + selection state.
 * The bus path means the restore is observable by analytics middleware
 * and replayable through the event store, while undoCapture's
 * `restore` middleware profile keeps it from being captured itself.
 *
 * Lives under `cqrs/undo/` (not `core/store/`) because undo is a CQRS
 * concern. The static import cycle (historyStore → commandBus →
 * middleware → historyStore) is benign — no functions execute at
 * module-init time, so by first user action all bindings are populated.
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

    commandBus.dispatch(
      createCommand('layout.restore', {
        layout: previous,
        direction: 'undo',
        selection: previousSelection,
      })
    );

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

    commandBus.dispatch(
      createCommand('layout.restore', {
        layout: next,
        direction: 'redo',
        selection: nextSelection,
      })
    );

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
