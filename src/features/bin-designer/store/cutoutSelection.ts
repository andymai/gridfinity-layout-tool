/**
 * Lightweight store for cutout editor selection state.
 *
 * Bridges the 2D editor selection (CutoutsSection) to the 3D preview
 * (GhostCutouts) so selected cutouts can be highlighted in both views.
 */

import { create } from 'zustand';

interface CutoutSelectionState {
  /** IDs of currently selected cutouts in the 2D editor */
  selectedIds: ReadonlySet<string>;
  setSelectedIds: (ids: ReadonlySet<string>) => void;
}

export const useCutoutSelection = create<CutoutSelectionState>((set) => ({
  selectedIds: new Set(),
  setSelectedIds: (ids) => set({ selectedIds: ids }),
}));
