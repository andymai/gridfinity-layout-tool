/**
 * Hook that monitors layout state and triggers suggestion generation.
 *
 * Watches for:
 * 1. Sufficient labeled bins (5+)
 * 2. Layout name is still default ("Untitled layout")
 * 3. Layout hasn't been dismissed for suggestions
 *
 * Uses local algorithm for instant suggestions, then fires LLM request
 * in parallel for culturally-localized suggestions.
 */

import { useEffect, useMemo, useRef, useCallback } from 'react';
import { useLayoutStore } from '@/core/store/layout';
import { useLibraryStore } from '@/core/store/library';
import { useShallow } from 'zustand/react/shallow';
import { getGridBins, getLabeledBins } from '@/shared/utils/bins';
import { inferDrawerPurpose } from '@/shared/analytics/purposeInference';
import { useLocale } from '@/i18n';
import { isOk } from '@/core/result';
import { fetchNameSuggestions, type SuggestNameRequest } from '@/core/api/suggestName';
import { useNameSuggestionStore } from '../store';
import { SUGGESTION_THRESHOLD, DEFAULT_LAYOUT_NAME } from '../types';
import type { SuggestionInput, CategoryCount, SuggestionResult, NameSuggestion } from '../types';

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
/** Timeout for LLM API calls (ms) */
const LLM_TIMEOUT = 5000;

export function useSuggestionTrigger() {
  const { bins, categories, name } = useLayoutStore(
    useShallow((s) => ({
      bins: s.layout.bins,
      categories: s.layout.categories,
      name: s.layout.name,
    }))
  );

  const activeLayoutId = useLibraryStore((s) => s.library.activeLayoutId);
  const getNameSuggestionState = useLibraryStore((s) => s.getNameSuggestionState);
  const libraryEntries = useLibraryStore((s) => s.library.entries);

  // Use app's configured locale (not navigator.language)
  const { locale } = useLocale();

  const { status, layoutId, setSuggestions, setLoadingMore, shouldShowFor } =
    useNameSuggestionStore(
      useShallow((s) => ({
        status: s.status,
        layoutId: s.layoutId,
        setSuggestions: s.setSuggestions,
        setLoadingMore: s.setLoadingMore,
        shouldShowFor: s.shouldShowFor,
      }))
    );

  // Get full layout for purpose inference (only when needed)
  const layout = useLayoutStore((s) => s.layout);

  // Count labeled bins (excluding staging)
  const labeledBinCount = useMemo(() => {
    return getLabeledBins(getGridBins(bins)).length;
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

    // Skip if layout was permanently dismissed (persisted state)
    const persistedState = getNameSuggestionState(activeLayoutId);
    if (persistedState?.dismissed) {
      return;
    }

    // Check conditions
    const hasEnoughLabels = labeledBinCount >= SUGGESTION_THRESHOLD;
    const canShow = shouldShowFor(activeLayoutId);

    if (hasEnoughLabels && isDefaultName && canShow && status === 'idle') {
      // Get existing layout names to avoid duplicates
      const existingNames = libraryEntries.map((e) => e.name);

      // Build suggestion input
      const input = buildSuggestionInput(layout, categories, locale, existingNames);

      // Create AbortController to cancel LLM request on layout change
      const abortController = new AbortController();

      // Lazy-load and generate local suggestions first (instant)
      loadGenerateSuggestions()
        .then(async (generateSuggestions) => {
          if (abortController.signal.aborted) return;

          const localResult = generateSuggestions(input);

          // Show local suggestions immediately if good enough
          if (localResult.primary && localResult.primary.confidence >= 0.4) {
            setSuggestions(localResult, activeLayoutId, 'auto');
            triggeredRef.current = activeLayoutId;
          }

          // Fire LLM request for better localized suggestions
          // Skip for English - local algorithm already generates English names
          const isEnglish = input.locale === 'en' || input.locale.startsWith('en-');
          if (localResult.primary && !isEnglish) {
            setLoadingMore(true);
            try {
              // Pass local suggestions as hints for better localization
              const hints = [
                localResult.primary.name,
                ...localResult.alternatives.map((a) => a.name),
              ];
              const llmResult = await fetchLLMSuggestions(input, hints, abortController.signal);
              if (!llmResult) return;

              // Merge LLM suggestions with local ones (LLM takes priority)
              const mergedResult = mergeSuggestions(localResult, llmResult);
              setSuggestions(mergedResult, activeLayoutId, 'auto');
            } finally {
              setLoadingMore(false);
            }
          }
        })
        .catch(() => {
          // Silently fail if dynamic import fails - suggestions are non-critical
        });

      return () => {
        abortController.abort();
      };
    }
    return undefined;
  }, [
    labeledBinCount,
    isDefaultName,
    activeLayoutId,
    status,
    shouldShowFor,
    getNameSuggestionState,
    layout,
    categories,
    locale,
    libraryEntries,
    setSuggestions,
    setLoadingMore,
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
      // Get existing layout names to avoid duplicates
      const existingNames = libraryEntries.map((e) => e.name);
      const input = buildSuggestionInput(layout, categories, locale, existingNames);
      const generateSuggestions = await loadGenerateSuggestions();

      // Generate local suggestions first
      const localResult = generateSuggestions(input);

      // Show local suggestions immediately
      if (localResult.primary) {
        setSuggestions(localResult, activeLayoutId, source);
      }

      // Fire LLM request for better localized suggestions
      // Skip for English - local algorithm already generates English names
      const isEnglish = input.locale === 'en' || input.locale.startsWith('en-');
      if (!isEnglish) {
        setLoadingMore(true);
        try {
          // Pass local suggestions as hints for better localization
          const hints = localResult.primary
            ? [localResult.primary.name, ...localResult.alternatives.map((a) => a.name)]
            : undefined;
          const llmResult = await fetchLLMSuggestions(input, hints);
          if (llmResult) {
            const mergedResult = mergeSuggestions(localResult, llmResult);
            setSuggestions(mergedResult, activeLayoutId, source);
            return mergedResult;
          }
        } finally {
          setLoadingMore(false);
        }
      }

      return localResult;
    },
    [layout, categories, locale, libraryEntries, activeLayoutId, setSuggestions, setLoadingMore]
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
  categories: ReturnType<typeof useLayoutStore.getState>['layout']['categories'],
  locale: string,
  existingNames?: string[]
): SuggestionInput {
  // Extract labels from on-grid bins
  const labels = getLabeledBins(getGridBins(layout.bins)).map((b) => b.label);

  // Count bins per category
  const categoryCountMap = new Map<string, number>();
  for (const bin of getGridBins(layout.bins)) {
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
    locale,
    existingNames,
  };
}

/**
 * Fetch suggestions from the LLM API.
 * Returns null if the request fails, times out, or is cancelled.
 *
 * @param input - The suggestion input
 * @param hints - Optional English suggestions to help the LLM localize
 * @param signal - Optional AbortSignal for cancellation
 */
async function fetchLLMSuggestions(
  input: SuggestionInput,
  hints?: string[],
  signal?: AbortSignal
): Promise<NameSuggestion[] | null> {
  try {
    const request: SuggestNameRequest = {
      labels: input.labels.slice(0, 50), // API limit
      drawerSize: {
        w: input.drawer.width,
        d: input.drawer.depth,
        h: input.drawer.height,
      },
      locale: input.locale,
      purpose: input.purpose ?? undefined,
      hints: hints?.slice(0, 5), // Pass English suggestions as localization hints
    };

    const result = await fetchNameSuggestions(request, { timeout: LLM_TIMEOUT, signal });

    if (isOk(result) && result.value.suggestions.length > 0) {
      // Convert API response to NameSuggestion format
      // LLM suggestions get high confidence (0.9) since they're culturally-localized
      return result.value.suggestions.map((s, i) => ({
        name: s.name,
        confidence: 0.9 - i * 0.05, // First: 0.9, second: 0.85, etc.
        source: s.source, // 'server_ml' from API
      }));
    }

    return null;
  } catch {
    // Silently fail - local suggestions are the fallback
    return null;
  }
}

/**
 * Merge LLM suggestions with local suggestions.
 * LLM suggestions take priority as primary, local becomes alternatives.
 */
function mergeSuggestions(
  local: SuggestionResult,
  llmSuggestions: NameSuggestion[]
): SuggestionResult {
  if (llmSuggestions.length === 0) {
    return local;
  }

  // LLM primary takes over
  const primary = llmSuggestions[0];

  // Combine remaining LLM suggestions with local alternatives
  // Filter out duplicates (same name, case-insensitive)
  const llmAlternatives = llmSuggestions.slice(1);
  const localAlternatives = local.alternatives.filter(
    (alt) => !llmSuggestions.some((llm) => llm.name.toLowerCase() === alt.name.toLowerCase())
  );

  // Include local primary as alternative if it's different from LLM primary
  const alternatives: NameSuggestion[] = [...llmAlternatives];
  if (local.primary && local.primary.name.toLowerCase() !== primary.name.toLowerCase()) {
    alternatives.push(local.primary);
  }
  alternatives.push(...localAlternatives);

  // Limit to 3 alternatives
  return {
    primary,
    alternatives: alternatives.slice(0, 3),
    timestamp: Date.now(),
  };
}
