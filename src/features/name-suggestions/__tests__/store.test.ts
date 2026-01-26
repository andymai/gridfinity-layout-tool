/**
 * Tests for name suggestion store.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useNameSuggestionStore } from '../store';
import { useLibraryStore } from '@/core/store/library';
import type { SuggestionResult } from '../types';

// Track dismissed layouts for mock
const dismissedLayouts = new Map<string, boolean>();

// Mock the library store
vi.mock('@/core/store/library', () => ({
  useLibraryStore: {
    getState: () => ({
      setNameSuggestionDismissed: (layoutId: string, dismissed: boolean) => {
        if (dismissed) {
          dismissedLayouts.set(layoutId, true);
        } else {
          dismissedLayouts.delete(layoutId);
        }
      },
      getNameSuggestionState: (layoutId: string) => {
        return dismissedLayouts.has(layoutId) ? { dismissed: true, dismissedAt: Date.now(), dismissCount: 1 } : undefined;
      },
    }),
  },
}));

describe('useNameSuggestionStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useNameSuggestionStore.getState().reset();
    // Clear mock dismissed layouts
    dismissedLayouts.clear();
  });

  const mockResult: SuggestionResult = {
    primary: {
      name: 'Tools Drawer',
      source: 'labels',
      confidence: 0.8,
    },
    alternatives: [
      { name: 'Workshop Organizer', source: 'purpose', confidence: 0.65 },
      { name: 'Medium Drawer', source: 'dimensions', confidence: 0.3 },
    ],
    timestamp: Date.now(),
  };

  describe('initial state', () => {
    it('starts with idle status and no result', () => {
      const state = useNameSuggestionStore.getState();

      expect(state.status).toBe('idle');
      expect(state.result).toBeNull();
      expect(state.layoutId).toBeNull();
      expect(state.isExpanded).toBe(false);
    });
  });

  describe('setSuggestions', () => {
    it('sets suggestions and updates status to ready', () => {
      const store = useNameSuggestionStore.getState();
      store.setSuggestions(mockResult, 'layout-123', 'auto');

      const state = useNameSuggestionStore.getState();
      expect(state.result).toEqual(mockResult);
      expect(state.layoutId).toBe('layout-123');
      expect(state.status).toBe('ready');
      expect(state.triggerSource).toBe('auto');
    });

    it('does not set suggestions if recently dismissed', () => {
      const store = useNameSuggestionStore.getState();

      // First set and dismiss
      store.setSuggestions(mockResult, 'layout-123', 'auto');
      store.dismiss();

      // Try to set again for same layout
      const newResult: SuggestionResult = {
        ...mockResult,
        primary: { name: 'New Suggestion', source: 'labels', confidence: 0.9 },
      };
      store.setSuggestions(newResult, 'layout-123', 'auto');

      // Should still be dismissed, not updated
      const state = useNameSuggestionStore.getState();
      expect(state.status).toBe('dismissed');
    });

    it('allows suggestions for different layout after dismiss', () => {
      const store = useNameSuggestionStore.getState();

      // Set and dismiss for layout-123
      store.setSuggestions(mockResult, 'layout-123', 'auto');
      store.dismiss();

      // Set for different layout
      store.setSuggestions(mockResult, 'layout-456', 'command');

      const state = useNameSuggestionStore.getState();
      expect(state.status).toBe('ready');
      expect(state.layoutId).toBe('layout-456');
    });

    it('sets status to idle if no primary suggestion', () => {
      const store = useNameSuggestionStore.getState();
      const emptyResult: SuggestionResult = {
        primary: null,
        alternatives: [],
        timestamp: Date.now(),
      };

      store.setSuggestions(emptyResult, 'layout-123', 'auto');

      const state = useNameSuggestionStore.getState();
      expect(state.status).toBe('idle');
    });
  });

  describe('dismiss', () => {
    it('sets status to dismissed and records timestamp', () => {
      const store = useNameSuggestionStore.getState();
      store.setSuggestions(mockResult, 'layout-123', 'auto');

      const beforeDismiss = Date.now();
      store.dismiss();

      const state = useNameSuggestionStore.getState();
      expect(state.status).toBe('dismissed');
      expect(state.dismissedAt).not.toBeNull();
      expect(state.dismissedAt).toBeGreaterThanOrEqual(beforeDismiss);
    });

    it('collapses the popover on dismiss', () => {
      const store = useNameSuggestionStore.getState();
      store.setSuggestions(mockResult, 'layout-123', 'auto');
      store.expand();

      store.dismiss();

      const state = useNameSuggestionStore.getState();
      expect(state.isExpanded).toBe(false);
    });
  });

  describe('accept', () => {
    it('sets status to accepted', () => {
      const store = useNameSuggestionStore.getState();
      store.setSuggestions(mockResult, 'layout-123', 'auto');

      store.accept();

      const state = useNameSuggestionStore.getState();
      expect(state.status).toBe('accepted');
    });

    it('collapses the popover on accept', () => {
      const store = useNameSuggestionStore.getState();
      store.setSuggestions(mockResult, 'layout-123', 'auto');
      store.expand();

      store.accept();

      const state = useNameSuggestionStore.getState();
      expect(state.isExpanded).toBe(false);
      expect(state.showAlternatives).toBe(false);
    });
  });

  describe('expand/collapse', () => {
    it('toggles expanded state', () => {
      const store = useNameSuggestionStore.getState();

      store.expand();
      expect(useNameSuggestionStore.getState().isExpanded).toBe(true);

      store.collapse();
      expect(useNameSuggestionStore.getState().isExpanded).toBe(false);
    });

    it('collapse also hides alternatives', () => {
      const store = useNameSuggestionStore.getState();
      store.expand();
      store.toggleAlternatives();

      store.collapse();

      const state = useNameSuggestionStore.getState();
      expect(state.isExpanded).toBe(false);
      expect(state.showAlternatives).toBe(false);
    });
  });

  describe('toggleAlternatives', () => {
    it('toggles alternatives visibility', () => {
      const store = useNameSuggestionStore.getState();

      expect(useNameSuggestionStore.getState().showAlternatives).toBe(false);

      store.toggleAlternatives();
      expect(useNameSuggestionStore.getState().showAlternatives).toBe(true);

      store.toggleAlternatives();
      expect(useNameSuggestionStore.getState().showAlternatives).toBe(false);
    });
  });

  describe('shouldShowFor', () => {
    it('returns true for new layout', () => {
      const store = useNameSuggestionStore.getState();
      expect(store.shouldShowFor('new-layout')).toBe(true);
    });

    it('returns false for recently dismissed layout', () => {
      const store = useNameSuggestionStore.getState();
      store.setSuggestions(mockResult, 'layout-123', 'auto');
      store.dismiss();

      expect(store.shouldShowFor('layout-123')).toBe(false);
    });

    it('returns true for different layout even if one was dismissed', () => {
      const store = useNameSuggestionStore.getState();
      store.setSuggestions(mockResult, 'layout-123', 'auto');
      store.dismiss();

      expect(store.shouldShowFor('layout-456')).toBe(true);
    });

    it('returns false after suggestion was accepted', () => {
      const store = useNameSuggestionStore.getState();
      store.setSuggestions(mockResult, 'layout-123', 'auto');
      store.accept();

      expect(store.shouldShowFor('layout-123')).toBe(false);
    });
  });

  describe('reset', () => {
    it('resets all state to initial values', () => {
      const store = useNameSuggestionStore.getState();
      store.setSuggestions(mockResult, 'layout-123', 'command');
      store.expand();
      store.toggleAlternatives();

      store.reset();

      const state = useNameSuggestionStore.getState();
      expect(state.result).toBeNull();
      expect(state.status).toBe('idle');
      expect(state.layoutId).toBeNull();
      expect(state.dismissedAt).toBeNull();
      expect(state.isExpanded).toBe(false);
      expect(state.showAlternatives).toBe(false);
      expect(state.triggerSource).toBeNull();
    });
  });
});
