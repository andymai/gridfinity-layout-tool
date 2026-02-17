/**
 * Hook for fetching size suggestions based on current layout state.
 *
 * Gated behind the 'size-suggestions' labs feature flag.
 * Debounces 2s after bin placement, deduplicates via lastFetchParams,
 * and cancels in-flight requests on new fetch.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useLayoutStore } from '@/core/store/layout';
import { useLabsStore } from '@/core/store/labs';
import { STAGING_ID } from '@/core/constants';
import { useSizeSuggestionStore } from '../store';
import type { SizeSuggestResponse } from '../types';

const DEBOUNCE_MS = 2000;
const API_ENDPOINT = '/api/size-suggest';

interface UseSizeSuggestionsReturn {
  fetchSuggestions: () => void;
  debouncedFetch: () => void;
}

/**
 * Hook that fetches size suggestions based on layout state.
 * Returns imperative fetch functions for use in effects and handlers.
 */
export function useSizeSuggestions(): UseSizeSuggestionsReturn {
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(() => {
    const isEnabled = useLabsStore.getState().isFeatureEnabled('size-suggestions');
    if (!isEnabled) return;

    const layout = useLayoutStore.getState().layout;
    const { setLoading, setSuggestions, setLastFetchParams, lastFetchParams } =
      useSizeSuggestionStore.getState();

    // Build request params
    const onGridBins = layout.bins.filter((bin) => bin.layerId !== STAGING_ID);
    const requestParams = JSON.stringify({
      drawer: {
        width: layout.drawer.width,
        depth: layout.drawer.depth,
      },
      bins: onGridBins.map((bin) => ({
        width: bin.width,
        depth: bin.depth,
        x: bin.x,
        y: bin.y,
        label: bin.label || '',
      })),
    });

    // Deduplicate - skip if identical to last fetch
    if (requestParams === lastFetchParams) return;

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setLastFetchParams(requestParams);

    fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestParams,
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data: unknown = await response.json();
        return data as SizeSuggestResponse;
      })
      .then((data) => {
        if (!abortController.signal.aborted) {
          setSuggestions(data.suggestions);
        }
      })
      .catch(() => {
        // Silently fail - no toast, no retry
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      });
  }, []);

  const debouncedFetch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions();
    }, DEBOUNCE_MS);
  }, [fetchSuggestions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Auto-refresh when bin count changes (Task 9)
  useEffect(() => {
    if (!useLabsStore.getState().isFeatureEnabled('size-suggestions')) return;

    let prevBinCount = useLayoutStore.getState().layout.bins.length;
    const unsub = useLayoutStore.subscribe((state) => {
      const newCount = state.layout.bins.length;
      if (newCount !== prevBinCount) {
        prevBinCount = newCount;
        debouncedFetch();
      }
    });

    return unsub;
  }, [debouncedFetch]);

  return { fetchSuggestions, debouncedFetch };
}
