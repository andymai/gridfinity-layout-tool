import { create } from 'zustand';

/**
 * Mobile Store
 *
 * Manages mobile-specific UI state.
 * Extracted from ui.ts as part of the god object decomposition.
 *
 * This store is only used by mobile components, allowing the mobile layout
 * to be fully lazy-loaded without affecting desktop performance.
 */

export type MobilePanel =
  | 'layers'
  | 'inspector'
  | 'categories'
  | 'print'
  | 'settings'
  | 'layouts'
  | 'participants'
  | null;

export type MobileLayersTab = 'layers' | 'tools';

interface MobileState {
  activeMobilePanel: MobilePanel;
  mobileLayersTab: MobileLayersTab;
}

interface MobileActions {
  setActiveMobilePanel: (panel: MobilePanel) => void;
  closeMobilePanel: () => void;
  toggleMobilePanel: (panel: MobilePanel) => void;
  setMobileLayersTab: (tab: MobileLayersTab) => void;
}

export type MobileStore = MobileState & MobileActions;

export const INITIAL_MOBILE_STATE = {
  activeMobilePanel: null as MobilePanel,
  mobileLayersTab: 'layers' as MobileLayersTab,
} as const;

export const useMobileStore = create<MobileStore>((set) => ({
  // Initial state
  ...INITIAL_MOBILE_STATE,

  // Actions
  setActiveMobilePanel: (panel) => set({ activeMobilePanel: panel }),
  closeMobilePanel: () => set({ activeMobilePanel: null }),
  toggleMobilePanel: (panel) =>
    set((state) => ({
      activeMobilePanel: state.activeMobilePanel === panel ? null : panel,
    })),
  setMobileLayersTab: (tab) => set({ mobileLayersTab: tab }),
}));
