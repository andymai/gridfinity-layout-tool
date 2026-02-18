/**
 * Tests for the size suggestion store hook `useSizeSuggestionStore`.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useSizeSuggestionStore } from '../store';
import type { SizeSuggestion } from '../types';

describe('useSizeSuggestionStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useSizeSuggestionStore.getState().reset();
  });

  const mockSuggestions: SizeSuggestion[] = [
    {
      size: '2x1',
      score: 0.9,
      position: { x: 0, y: 0 },
      positionSource: 'gap_fill',
    },
    {
      size: '1x1',
      score: 0.7,
      position: null,
      positionSource: 'heuristic',
    },
  ];

  describe('initial state', () => {
    it('starts with empty suggestions and defaults', () => {
      const state = useSizeSuggestionStore.getState();

      expect(state.suggestions).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.isDismissed).toBe(false);
      expect(state.lastFetchParams).toBeNull();
    });
  });

  describe('setSuggestions', () => {
    it('sets suggestions and clears loading state', () => {
      const store = useSizeSuggestionStore.getState();
      store.setLoading(true);
      store.setSuggestions(mockSuggestions);

      const state = useSizeSuggestionStore.getState();
      expect(state.suggestions).toEqual(mockSuggestions);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('setLoading', () => {
    it('sets loading state', () => {
      const store = useSizeSuggestionStore.getState();
      store.setLoading(true);

      expect(useSizeSuggestionStore.getState().isLoading).toBe(true);

      store.setLoading(false);

      expect(useSizeSuggestionStore.getState().isLoading).toBe(false);
    });
  });

  describe('dismiss', () => {
    it('sets isDismissed and clears suggestions', () => {
      const store = useSizeSuggestionStore.getState();
      store.setSuggestions(mockSuggestions);

      store.dismiss();

      const state = useSizeSuggestionStore.getState();
      expect(state.isDismissed).toBe(true);
      expect(state.suggestions).toEqual([]);
    });
  });

  describe('reset', () => {
    it('resets all state to initial values', () => {
      const store = useSizeSuggestionStore.getState();
      store.setSuggestions(mockSuggestions);
      store.setLoading(true);
      store.setLastFetchParams('{"bins":[]}');
      store.dismiss();

      store.reset();

      const state = useSizeSuggestionStore.getState();
      expect(state.suggestions).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.isDismissed).toBe(false);
      expect(state.lastFetchParams).toBeNull();
    });
  });

  describe('setLastFetchParams', () => {
    it('updates lastFetchParams for deduplication', () => {
      const store = useSizeSuggestionStore.getState();
      const params = '{"drawer":{"width":10,"depth":8},"bins":[]}';

      store.setLastFetchParams(params);

      expect(useSizeSuggestionStore.getState().lastFetchParams).toBe(params);
    });

    it('allows deduplication via lastFetchParams', () => {
      const store = useSizeSuggestionStore.getState();
      const params1 = '{"drawer":{"width":10,"depth":8},"bins":[]}';
      const params2 = '{"drawer":{"width":12,"depth":8},"bins":[]}';

      store.setLastFetchParams(params1);
      expect(useSizeSuggestionStore.getState().lastFetchParams).toBe(params1);

      store.setLastFetchParams(params2);
      expect(useSizeSuggestionStore.getState().lastFetchParams).toBe(params2);
    });
  });
});
