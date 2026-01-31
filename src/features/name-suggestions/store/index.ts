/**
 * Zustand store for name suggestion state management.
 *
 * Dismissal is persisted per-layout in LayoutEntry.nameSuggestionState
 * via the library store, so it survives page refreshes.
 */

import { create } from 'zustand';
import { useLibraryStore } from '@/core/store/library';
import { layoutId as toLayoutId } from '@/core/types';
import type { SuggestionResult, SuggestionStatus } from '../types';

interface NameSuggestionState {
  /** Current suggestion result */
  result: SuggestionResult | null;
  /** Current status */
  status: SuggestionStatus;
  /** Layout ID these suggestions are for */
  layoutId: string | null;
  /** Timestamp when suggestions were dismissed */
  dismissedAt: number | null;
  /** Whether the dropdown/popover is expanded */
  isExpanded: boolean;
  /** Whether to show alternatives in the dropdown */
  showAlternatives: boolean;
  /** Source of how suggestions were triggered */
  triggerSource: 'auto' | 'command' | 'menu' | null;
  /** Whether LLM-powered suggestions are being fetched */
  isLoadingMore: boolean;

  // Actions
  setSuggestions: (
    result: SuggestionResult,
    layoutId: string,
    triggerSource?: 'auto' | 'command' | 'menu'
  ) => void;
  setStatus: (status: SuggestionStatus) => void;
  setLoadingMore: (loading: boolean) => void;
  dismiss: () => void;
  accept: () => void;
  expand: () => void;
  collapse: () => void;
  toggleAlternatives: () => void;
  reset: () => void;
  /** Check if suggestions should be shown for a layout */
  shouldShowFor: (layoutId: string) => boolean;
}

export const useNameSuggestionStore = create<NameSuggestionState>()((set, get) => ({
  result: null,
  status: 'idle',
  layoutId: null,
  dismissedAt: null,
  isExpanded: false,
  showAlternatives: false,
  triggerSource: null,
  isLoadingMore: false,

  setSuggestions: (result, layoutId, triggerSource = 'auto') => {
    // Don't auto-show if permanently dismissed for this layout
    // (but allow manual triggers like command palette to bypass)
    if (triggerSource === 'auto') {
      const persistedState = useLibraryStore
        .getState()
        .getNameSuggestionState(toLayoutId(layoutId));
      if (persistedState?.dismissed) {
        return; // Layout was dismissed, don't auto-show
      }
    }

    set({
      result,
      status: result.primary ? 'ready' : 'idle',
      layoutId,
      dismissedAt: null,
      isExpanded: false,
      showAlternatives: false,
      triggerSource,
    });
  },

  setStatus: (status) => {
    set({ status });
  },

  setLoadingMore: (loading) => {
    set({ isLoadingMore: loading });
  },

  dismiss: () => {
    const { layoutId } = get();

    // Persist dismissal to library store (survives page refresh)
    if (layoutId) {
      useLibraryStore.getState().setNameSuggestionDismissed(toLayoutId(layoutId), true);
    }

    set({
      status: 'dismissed',
      dismissedAt: Date.now(),
      isExpanded: false,
      showAlternatives: false,
    });
  },

  accept: () => {
    set({
      status: 'accepted',
      isExpanded: false,
      showAlternatives: false,
    });
  },

  expand: () => {
    set({ isExpanded: true });
  },

  collapse: () => {
    set({ isExpanded: false, showAlternatives: false });
  },

  toggleAlternatives: () => {
    set((state) => ({ showAlternatives: !state.showAlternatives }));
  },

  reset: () => {
    set({
      result: null,
      status: 'idle',
      layoutId: null,
      dismissedAt: null,
      isExpanded: false,
      showAlternatives: false,
      triggerSource: null,
      isLoadingMore: false,
    });
  },

  shouldShowFor: (layoutId) => {
    const state = get();

    // Check persisted dismissal state from library store (survives page refresh)
    const persistedState = useLibraryStore.getState().getNameSuggestionState(toLayoutId(layoutId));
    if (persistedState?.dismissed) {
      return false; // Permanently dismissed for this layout
    }

    // Different layout - always allow
    if (state.layoutId !== layoutId) {
      return true;
    }

    // Same layout, not persistently dismissed - check current session status
    return state.status !== 'accepted';
  },
}));
