import { create } from 'zustand';

/** Mirrors GalleryTabId in the shell; core cannot import from there. */
export type GalleryTabRequest = 'examples' | 'community';

interface BinExampleGalleryState {
  isOpen: boolean;
  /**
   * Tab the opener asked for, overriding the remembered one for this visit.
   *
   * The panel entry names Community and has to land on Community; without
   * this it would open on whatever tab was last used and read as a broken
   * link the first time someone's remembered tab was Examples.
   */
  requestedTab: GalleryTabRequest | null;
}

interface BinExampleGalleryActions {
  open: (tab?: GalleryTabRequest) => void;
  close: () => void;
  toggle: () => void;
}

export type BinExampleGalleryStore = BinExampleGalleryState & BinExampleGalleryActions;

export const INITIAL_BIN_EXAMPLE_GALLERY_STATE: BinExampleGalleryState = {
  isOpen: false,
  requestedTab: null,
};

export const useBinExampleGalleryStore = create<BinExampleGalleryStore>((set) => ({
  ...INITIAL_BIN_EXAMPLE_GALLERY_STATE,
  open: (tab) => {
    set({ isOpen: true, requestedTab: tab ?? null });
  },
  close: () => {
    // Cleared on close so the next opener that names no tab gets the
    // remembered one rather than inheriting this visit's override.
    set({ isOpen: false, requestedTab: null });
  },
  toggle: () => {
    set((state) => ({ isOpen: !state.isOpen, requestedTab: null }));
  },
}));
