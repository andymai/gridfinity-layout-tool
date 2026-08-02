import { create } from 'zustand';
import type { GridUnits, HeightUnits, LayerId, Mm } from '@/core/types';

/**
 * Composition seam for the "find bins that fit" flow, mirroring
 * communityDetail: the grid editor records the selected gap here and the
 * community gallery/detail (and the shell placement bridge) read it, so
 * neither feature needs a cross-feature import.
 */

export interface GapFitConstraint {
  readonly maxWidth: GridUnits;
  readonly maxDepth: GridUnits;
  /** Remaining stack budget above the target layer, already net of the layers below it. */
  readonly maxHeight: HeightUnits;
  /**
   * The layout's unit scales at selection time. Placement hard-rejects any
   * design whose mm-per-unit scales differ from the layout's, so the gallery
   * needs these to exclude cards that could never place into this gap.
   */
  readonly gridUnitMm: Mm;
  readonly gridUnitMmY: Mm;
  readonly heightUnitMm: Mm;
  readonly targetPosition: {
    readonly x: GridUnits;
    readonly y: GridUnits;
    readonly layerId: LayerId;
  };
}

interface GapFitState {
  constraint: GapFitConstraint | null;
}

interface GapFitActions {
  setConstraint: (constraint: GapFitConstraint) => void;
  clear: () => void;
}

export type GapFitStore = GapFitState & GapFitActions;

export const INITIAL_GAP_FIT_STATE: GapFitState = {
  constraint: null,
};

export const useGapFitStore = create<GapFitStore>((set) => ({
  ...INITIAL_GAP_FIT_STATE,
  setConstraint: (constraint) => {
    set({ constraint });
  },
  clear: () => {
    set({ constraint: null });
  },
}));
