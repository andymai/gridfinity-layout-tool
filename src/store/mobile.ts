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

export const useMobileStore = create<MobileStore>((set) => ({
  // Initial state
  activeMobilePanel: null,
  mobileLayersTab: 'layers',

  // Actions
  setActiveMobilePanel: (panel) => set({ activeMobilePanel: panel }),
  closeMobilePanel: () => set({ activeMobilePanel: null }),
  toggleMobilePanel: (panel) =>
    set((state) => ({
      activeMobilePanel: state.activeMobilePanel === panel ? null : panel,
    })),
  setMobileLayersTab: (tab) => set({ mobileLayersTab: tab }),
}));
