import { create } from 'zustand';

const RECENT_COLORS_LIMIT = 8;

interface RecentColorsState {
  readonly recentColors: readonly string[];
  remember: (hex: string) => void;
}

/**
 * Session LRU of recently-committed colors, shared by the left ColorsSection
 * pickers and the right inspector's zone editor so a color picked in one
 * surface offers itself as a quick-pick in the other. Not persisted and not
 * part of saved designs — purely an editing convenience.
 */
export const useRecentColorsStore = create<RecentColorsState>((set) => ({
  recentColors: [],
  remember: (hex) =>
    set((s) => {
      const lower = hex.toLowerCase();
      return {
        recentColors: [lower, ...s.recentColors.filter((c) => c !== lower)].slice(
          0,
          RECENT_COLORS_LIMIT
        ),
      };
    }),
}));
