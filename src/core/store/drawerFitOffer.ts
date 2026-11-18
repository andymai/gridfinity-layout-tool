import { create } from 'zustand';
import type { Layout } from '@/core/types';
import { effectiveGridUnitMmY } from '@/core/types';

/**
 * Composition seam between a drawer link and the drawer fit card: the link
 * opens whole units only, so it records the layout here and the drawer
 * settings offer the tighter fit from the layout's measurement. The offer
 * holds only while the grid and pitch it was made for still hold.
 */
export interface DrawerFitOffer {
  readonly layoutId: string;
  readonly width: number;
  readonly depth: number;
  readonly pitchX: number;
  readonly pitchY: number;
}

interface DrawerFitOfferState {
  offer: DrawerFitOffer | null;
}

interface DrawerFitOfferActions {
  offerFor: (layoutId: string, layout: Layout) => void;
  clear: () => void;
}

export type DrawerFitOfferStore = DrawerFitOfferState & DrawerFitOfferActions;

export const INITIAL_DRAWER_FIT_OFFER_STATE: DrawerFitOfferState = {
  offer: null,
};

export const useDrawerFitOfferStore = create<DrawerFitOfferStore>((set) => ({
  ...INITIAL_DRAWER_FIT_OFFER_STATE,
  offerFor: (layoutId, layout) => {
    set({
      offer: {
        layoutId,
        width: layout.drawer.width,
        depth: layout.drawer.depth,
        pitchX: layout.gridUnitMm,
        pitchY: effectiveGridUnitMmY(layout),
      },
    });
  },
  clear: () => {
    set({ offer: null });
  },
}));
