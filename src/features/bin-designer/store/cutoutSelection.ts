/**
 * Lightweight store for cutout editor selection state.
 *
 * Bridges the 2D editor selection (CutoutsSection) to the 3D preview
 * (GhostCutouts) so selected cutouts can be highlighted in both views.
 * Also carries live preview overrides during drag/resize/rotate.
 */

import { create } from 'zustand';
import type { Cutout } from '@/features/bin-designer/types';

interface CutoutSelectionState {
  /** IDs of currently selected cutouts in the 2D editor */
  selectedIds: ReadonlySet<string>;
  setSelectedIds: (ids: ReadonlySet<string>) => void;
  /** Live preview overrides during drag/resize/rotate interactions */
  previewOverrides: ReadonlyMap<string, Partial<Cutout>>;
  setPreviewOverrides: (overrides: ReadonlyMap<string, Partial<Cutout>>) => void;
}

export const useCutoutSelection = create<CutoutSelectionState>((set) => ({
  selectedIds: new Set(),
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  previewOverrides: new Map(),
  setPreviewOverrides: (overrides) => set({ previewOverrides: overrides }),
}));
