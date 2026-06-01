import { create } from 'zustand';

interface BinExampleGalleryState {
  isOpen: boolean;
}

interface BinExampleGalleryActions {
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export type BinExampleGalleryStore = BinExampleGalleryState & BinExampleGalleryActions;

export const INITIAL_BIN_EXAMPLE_GALLERY_STATE: BinExampleGalleryState = {
  isOpen: false,
};

export const useBinExampleGalleryStore = create<BinExampleGalleryStore>((set) => ({
  ...INITIAL_BIN_EXAMPLE_GALLERY_STATE,
  open: () => {
    set({ isOpen: true });
  },
  close: () => {
    set({ isOpen: false });
  },
  toggle: () => {
    set((state) => ({ isOpen: !state.isOpen }));
  },
}));
