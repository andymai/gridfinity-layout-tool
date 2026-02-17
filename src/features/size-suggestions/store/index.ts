/**
 * Zustand store for size suggestion state management.
 */

import { create } from 'zustand';
import type { SizeSuggestion } from '../types';

interface SizeSuggestionState {
  suggestions: SizeSuggestion[];
  isLoading: boolean;
  isDismissed: boolean;
  lastFetchParams: string | null;
  setSuggestions: (suggestions: SizeSuggestion[]) => void;
  setLoading: (loading: boolean) => void;
  dismiss: () => void;
  reset: () => void;
  setLastFetchParams: (params: string) => void;
}

export const useSizeSuggestionStore = create<SizeSuggestionState>()((set) => ({
  suggestions: [],
  isLoading: false,
  isDismissed: false,
  lastFetchParams: null,
  setSuggestions: (suggestions) => set({ suggestions, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  dismiss: () => set({ isDismissed: true, suggestions: [] }),
  reset: () =>
    set({ suggestions: [], isLoading: false, isDismissed: false, lastFetchParams: null }),
  setLastFetchParams: (lastFetchParams) => set({ lastFetchParams }),
}));
