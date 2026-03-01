import { create } from 'zustand';
import type { BinId, LayerId, CategoryId } from '@/core/types';
import { layerId, categoryId } from '@/core/types';

/**
 * Selection Store
 *
 * Manages what is selected, focused, and active in the application.
 * Extracted from ui.ts as part of the god object decomposition.
 *
 * State groups:
 * - Bin selection: which bins are selected for operations
 * - Layer/Category: active layer and category for new bins
 * - Focus: keyboard navigation focus (separate from selection)
 * - Quick label: which bin has the label popover open
 */

interface SelectionState {
  // Bin selection
  selectedBinIds: BinId[];

  // Active context
  activeLayerId: LayerId;
  activeCategoryId: CategoryId;

  // Keyboard navigation focus (separate from selection)
  focusedBinId: BinId | null;

  // Quick label popover (desktop double-click or L key)
  quickLabelBinId: BinId | null;
}

interface SelectionActions {
  // Bin selection
  setSelectedBin: (id: BinId | null) => void;
  setSelectedBins: (ids: BinId[]) => void;
  addToSelection: (id: BinId) => void;
  removeFromSelection: (id: BinId) => void;
  toggleSelection: (id: BinId) => void;
  clearSelection: () => void;

  // Active context
  setActiveLayer: (id: LayerId) => void;
  setActiveCategory: (id: CategoryId) => void;

  // Keyboard focus
  setFocusedBin: (binId: BinId | null) => void;

  // Quick label
  showQuickLabel: (binId: BinId) => void;
  hideQuickLabel: () => void;

  // History restoration (used by history store for undo/redo pruning)
  restoreSelection: (updates: Partial<SelectionState>) => void;
}

export type SelectionStore = SelectionState & SelectionActions;

export const INITIAL_SELECTION_STATE = {
  selectedBinIds: [] as BinId[],
  activeLayerId: layerId(''),
  activeCategoryId: categoryId('coral'),
  focusedBinId: null as BinId | null,
  quickLabelBinId: null as BinId | null,
} as const;

export const useSelectionStore = create<SelectionStore>((set) => ({
  // Initial state
  ...INITIAL_SELECTION_STATE,

  // Bin selection actions
  setSelectedBin: (id) => set({ selectedBinIds: id ? [id] : [] }),

  setSelectedBins: (ids) => set({ selectedBinIds: ids }),

  addToSelection: (id) =>
    set((state) => ({
      selectedBinIds: state.selectedBinIds.includes(id)
        ? state.selectedBinIds
        : [...state.selectedBinIds, id],
    })),

  removeFromSelection: (id) =>
    set((state) => ({
      selectedBinIds: state.selectedBinIds.filter((binId) => binId !== id),
    })),

  toggleSelection: (id) =>
    set((state) => ({
      selectedBinIds: state.selectedBinIds.includes(id)
        ? state.selectedBinIds.filter((binId) => binId !== id)
        : [...state.selectedBinIds, id],
    })),

  clearSelection: () => set({ selectedBinIds: [] }),

  // Active context actions
  setActiveLayer: (id) =>
    set({
      activeLayerId: id,
      // Clear selection on layer change (PRD: selection is layer-scoped)
      selectedBinIds: [],
    }),

  setActiveCategory: (id) => set({ activeCategoryId: id }),

  // Keyboard focus actions
  setFocusedBin: (binId) => set({ focusedBinId: binId }),

  // Quick label actions
  showQuickLabel: (binId) => set({ quickLabelBinId: binId }),
  hideQuickLabel: () => set({ quickLabelBinId: null }),

  // History restoration
  restoreSelection: (updates) => set(updates),
}));
