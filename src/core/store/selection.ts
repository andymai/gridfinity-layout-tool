import { create } from 'zustand';

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
  selectedBinIds: string[];

  // Active context
  activeLayerId: string;
  activeCategoryId: string;

  // Keyboard navigation focus (separate from selection)
  focusedBinId: string | null;

  // Quick label popover (desktop double-click or L key)
  quickLabelBinId: string | null;
}

interface SelectionActions {
  // Bin selection
  setSelectedBin: (id: string | null) => void;
  setSelectedBins: (ids: string[]) => void;
  addToSelection: (id: string) => void;
  removeFromSelection: (id: string) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;

  // Active context
  setActiveLayer: (id: string) => void;
  setActiveCategory: (id: string) => void;

  // Keyboard focus
  setFocusedBin: (binId: string | null) => void;

  // Quick label
  showQuickLabel: (binId: string) => void;
  hideQuickLabel: () => void;
}

export type SelectionStore = SelectionState & SelectionActions;

export const useSelectionStore = create<SelectionStore>((set) => ({
  // Initial state
  selectedBinIds: [],
  activeLayerId: '',
  activeCategoryId: 'coral',
  focusedBinId: null,
  quickLabelBinId: null,

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
}));
