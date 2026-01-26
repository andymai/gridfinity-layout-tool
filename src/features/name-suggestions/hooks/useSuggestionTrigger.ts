/**
 * Hook that monitors layout state and triggers suggestion generation.
 *
 * Watches for:
 * 1. Sufficient labeled bins (5+)
 * 2. Layout name is still default ("Untitled layout")
 * 3. Layout hasn't been dismissed for suggestions
 */

import { useEffect, useMemo, useRef, useCallback } from 'react';
import { useLayoutStore } from '@/core/store/layout';
import { useLibraryStore } from '@/core/store/library';
import { useShallow } from 'zustand/react/shallow';
import { STAGING_ID } from '@/core/constants';
import { inferDrawerPurpose } from '@/shared/analytics/purposeInference';
import { useNameSuggestionStore } from '../store';
import { SUGGESTION_THRESHOLD, DEFAULT_LAYOUT_NAME } from '../types';
import type { SuggestionInput, CategoryCount, SuggestionResult } from '../types';

// Lazy-load the heavy suggestion generation logic to reduce main bundle size
const loadGenerateSuggestions = () =>
  import('../utils/generateSuggestions').then((m) => m.generateSuggestions);

/**
 * Hook that monitors layout and triggers suggestions when conditions are met.
 *
 * Conditions:
 * - 5+ bins have labels
 * - Layout name is "Untitled layout" (or user manually triggers)
 * - Not recently dismissed
 *
 * @returns Object with trigger state and manual trigger function
 */
export function useSuggestionTrigger() {
  const { bins, categories, name } = useLayoutStore(
    useShallow((s) => ({
      bins: s.layout.bins,
      categories: s.layout.categories,
      name: s.layout.name,
    }))
  );

  const activeLayoutId = useLibraryStore((s) => s.library.activeLayoutId);

  const { status, layoutId, setSuggestions, shouldShowFor } = useNameSuggestionStore(
    useShallow((s) => ({
      status: s.status,
      layoutId: s.layoutId,
      setSuggestions: s.setSuggestions,
      shouldShowFor: s.shouldShowFor,
    }))
  );

  // Get full layout for purpose inference (only when needed)
  const layout = useLayoutStore((s) => s.layout);

  // Count labeled bins (excluding staging)
  const labeledBinCount = useMemo(() => {
    return bins.filter((b) => b.layerId !== STAGING_ID && b.label?.trim()).length;
  }, [bins]);

  // Check if layout name is the default
  const isDefaultName = name === DEFAULT_LAYOUT_NAME || name.trim() === '';

  // Track if we've already triggered for this layout to avoid re-triggering
  const triggeredRef = useRef<string | null>(null);

  // Auto-trigger when conditions are met
  useEffect(() => {
    // Skip if already triggered for this layout
    if (triggeredRef.current === activeLayoutId) {
      return;
    }

    // Check conditions
    const hasEnoughLabels = labeledBinCount >= SUGGESTION_THRESHOLD;
    const canShow = shouldShowFor(activeLayoutId);

    if (hasEnoughLabels && isDefaultName && canShow && status === 'idle') {
      // Build suggestion input
      const input = buildSuggestionInput(layout, categories);

      // Lazy-load and generate suggestions
      let cancelled = false;
      loadGenerateSuggestions().then((generateSuggestions) => {
        if (cancelled) return;

        const result = generateSuggestions(input);

        // Only set if we have a good suggestion
        if (result.primary && result.primary.confidence >= 0.4) {
          setSuggestions(result, activeLayoutId, 'auto');
          triggeredRef.current = activeLayoutId;
        }
      });

      return () => {
        cancelled = true;
      };
    }
    return undefined;
  }, [
    labeledBinCount,
    isDefaultName,
    activeLayoutId,
    status,
    shouldShowFor,
    layout,
    categories,
    setSuggestions,
  ]);

  // Reset triggered ref when layout changes
  useEffect(() => {
    if (layoutId !== activeLayoutId) {
      triggeredRef.current = null;
    }
  }, [activeLayoutId, layoutId]);

  /**
   * Manually trigger suggestion generation.
   * Used by Command Palette and Layout Manager menu.
   * Returns a promise that resolves to the suggestion result.
   */
  const triggerSuggestions = useCallback(
    async (source: 'command' | 'menu'): Promise<SuggestionResult> => {
      const input = buildSuggestionInput(layout, categories);
      const generateSuggestions = await loadGenerateSuggestions();
      const result = generateSuggestions(input);

      if (result.primary) {
        setSuggestions(result, activeLayoutId, source);
      }

      return result;
    },
    [layout, categories, activeLayoutId, setSuggestions]
  );

  return {
    /** Number of bins with labels */
    labeledBinCount,
    /** Whether conditions are met for showing suggestions */
    conditionsMet: labeledBinCount >= SUGGESTION_THRESHOLD && isDefaultName,
    /** Current suggestion status */
    status,
    /** Manually trigger suggestions (for command palette / menu) */
    triggerSuggestions,
  };
}

/**
 * Build SuggestionInput from layout data.
 */
function buildSuggestionInput(
  layout: ReturnType<typeof useLayoutStore.getState>['layout'],
  categories: ReturnType<typeof useLayoutStore.getState>['layout']['categories']
): SuggestionInput {
  // Extract labels from on-grid bins
  const labels = layout.bins
    .filter((b) => b.layerId !== STAGING_ID && b.label?.trim())
    .map((b) => b.label as string);

  // Count bins per category
  const categoryCountMap = new Map<string, number>();
  for (const bin of layout.bins) {
    if (bin.layerId === STAGING_ID) continue;
    if (bin.category) {
      categoryCountMap.set(bin.category, (categoryCountMap.get(bin.category) ?? 0) + 1);
    }
  }

  // Build category counts with names
  const categoryCounts: CategoryCount[] = categories
    .map((cat) => ({
      name: cat.name,
      count: categoryCountMap.get(cat.id) ?? 0,
    }))
    .filter((c) => c.count > 0);

  // Infer drawer purpose
  const purposeResult = inferDrawerPurpose(layout);

  return {
    labels,
    categories: categoryCounts,
    drawer: {
      width: layout.drawer.width,
      depth: layout.drawer.depth,
      height: layout.drawer.height,
    },
    purpose: purposeResult.purpose,
    locale: typeof navigator !== 'undefined' ? navigator.language : 'en',
  };
}
