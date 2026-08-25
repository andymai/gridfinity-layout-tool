/**
 * Lightweight store for cutout editor selection state.
 *
 * Bridges the 2D editor selection (CutoutsSection) to the 3D preview
 * (GhostCutouts) so selected cutouts can be highlighted in both views.
 * Also carries live preview overrides during drag/resize/rotate.
 *
 * The drill-in context lives here rather than in the designer store because it
 * is view state, not design state: it must not enter undo history, must not
 * reach a saved file, and has to be readable by everything that resolves "what
 * does this click select" — the canvas, the shape list and the arrange math.
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
  /**
   * Groups the editor has been drilled into, outermost first; `[]` is the top
   * level. Everything selection-related is resolved relative to this.
   */
  groupContext: readonly string[];
  setGroupContext: (context: readonly string[]) => void;
  /** Step into `groupId`, which must be a child of the current context. */
  enterGroup: (groupId: string) => void;
  /** Step back out one level. No-op at the top. */
  exitGroup: () => void;
}

export const useCutoutSelection = create<CutoutSelectionState>((set) => ({
  selectedIds: new Set(),
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  previewOverrides: new Map(),
  setPreviewOverrides: (overrides) => set({ previewOverrides: overrides }),
  groupContext: [],
  setGroupContext: (context) => set({ groupContext: context }),
  enterGroup: (groupId) =>
    set((state) =>
      state.groupContext.includes(groupId)
        ? state
        : { groupContext: [...state.groupContext, groupId] }
    ),
  exitGroup: () =>
    set((state) =>
      state.groupContext.length === 0 ? state : { groupContext: state.groupContext.slice(0, -1) }
    ),
}));
