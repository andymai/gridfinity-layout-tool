import { create } from 'zustand';

interface SharePopoverState {
  isOpen: boolean;
}

interface SharePopoverActions {
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export type SharePopoverStore = SharePopoverState & SharePopoverActions;

export const INITIAL_SHARE_POPOVER_STATE: SharePopoverState = {
  isOpen: false,
};

export const useSharePopoverStore = create<SharePopoverStore>((set) => ({
  ...INITIAL_SHARE_POPOVER_STATE,
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
