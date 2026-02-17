/**
 * Hook for fetching size suggestions based on current layout state.
 *
 * Gated behind the 'size-suggestions' labs feature flag.
 * Debounces 2s after bin placement, deduplicates via lastFetchParams,
 * and cancels in-flight requests on new fetch.
 */

import { useEffect, useRef } from 'react';
import { useLayoutStore } from '@/core/store/layout';
import { useLabsStore } from '@/core/store/labs';
import { STAGING_ID } from '@/core/constants';
import { useSizeSuggestionStore } from '../store';
import type { SizeSuggestResponse } from '../types';

const DEBOUNCE_MS = 2000;
const API_ENDPOINT = '/api/size-suggest';

/**
 * Hook that fetches size suggestions based on layout state.
 */
export function useSizeSuggestions(): void {
  const isFeatureEnabled = useLabsStore((s) => s.isFeatureEnabled('size-suggestions'));
  const layout = useLayoutStore((s) => s.layout);
  const { setLoading, setSuggestions, setLastFetchParams, lastFetchParams } =
    useSizeSuggestionStore();

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Feature flag gate
    if (!isFeatureEnabled) {
      return;
    }

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
    if (requestParams === lastFetchParams) {
      return;
    }

    // Cancel previous debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce 2s
    debounceTimerRef.current = setTimeout(() => {
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
    }, DEBOUNCE_MS);

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isFeatureEnabled, layout, lastFetchParams, setLoading, setSuggestions, setLastFetchParams]);
}
