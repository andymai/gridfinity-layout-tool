/**
 * Zustand store for name suggestion state management.
 */

import { create } from 'zustand';
import type { SuggestionResult, SuggestionStatus } from '../types';

/**
 * Duration in ms before dismissed suggestions can re-trigger.
 * Set to session-only (until page refresh) by using a very long timeout.
 */
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

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

  // Actions
  setSuggestions: (
    result: SuggestionResult,
    layoutId: string,
    triggerSource?: 'auto' | 'command' | 'menu'
  ) => void;
  setStatus: (status: SuggestionStatus) => void;
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

  setSuggestions: (result, layoutId, triggerSource = 'auto') => {
    const state = get();

    // Don't show if recently dismissed for this layout
    if (state.layoutId === layoutId && state.dismissedAt !== null) {
      const elapsed = Date.now() - state.dismissedAt;
      if (elapsed < DISMISS_DURATION_MS) {
        return;
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

  dismiss: () => {
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
    });
  },

  shouldShowFor: (layoutId) => {
    const state = get();

    // Different layout - always allow
    if (state.layoutId !== layoutId) {
      return true;
    }

    // Same layout - check if dismissed
    if (state.dismissedAt !== null) {
      const elapsed = Date.now() - state.dismissedAt;
      return elapsed >= DISMISS_DURATION_MS;
    }

    // Same layout, not dismissed - check status
    return state.status !== 'accepted';
  },
}));
